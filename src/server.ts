import {
    AngularNodeAppEngine,
    createNodeRequestHandler,
    isMainModule,
    writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import { environment } from './environments/environment';
import { slugify } from './app/shared/slug';

// Set timezone to Central Time for SSR
process.env['TZ'] = 'America/Chicago';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.disable('x-powered-by');
const angularApp = new AngularNodeAppEngine();

app.use(
    compression({
        filter: (req, res) => {
            // Don't compress responses if the client doesn't support it
            if (req.headers['x-no-compression']) {
                return false;
            }
            // Use compression for all other requests
            return compression.filter(req, res);
        },
        level: 6, // Compression level (1-9, where 9 is most compressed but slowest)
        threshold: 1024, // Only compress responses larger than 1KB
    })
);

/**
 * sitemap.txt lists the public pages that are switched on for the current phase of the event,
 * plus a page for every scheduled session and confirmed speaker once those are live.
 */
app.get('/sitemap.txt', async (req, res) => {
    try {
        const baseUrl = environment.siteUrl;
        const paths = ['', 'gallery', 'past', 'conduct', 'refunds'];
        if (environment.showCFP) paths.push('speaker-cfp');
        if (environment.showSponsor) paths.push('sponsors');
        if (environment.showSchedule) paths.push('schedule');
        if (environment.showSpeakers) paths.push('speakers');

        if (environment.showSchedule || environment.showSpeakers) {
            const response = await fetch(
                `${environment.firebaseConfig.databaseURL}/devfest${environment.year}.json`
            );
            if (!response.ok) {
                throw new Error(`Firebase responded with ${response.status}`);
            }
            const data = (await response.json()) ?? {};

            if (environment.showSchedule) {
                for (const [key, session] of Object.entries<any>(data.schedule ?? {})) {
                    if (session.title) {
                        paths.push(`schedule/${key}/${slugify(session.title)}`);
                    }
                }
            }
            if (environment.showSpeakers) {
                for (const [key, speaker] of Object.entries<any>(data.speakers ?? {})) {
                    if (speaker.name && speaker.confirmed) {
                        paths.push(`speakers/${key}/${slugify(speaker.name)}`);
                    }
                }
            }
        }

        res.set('Cache-Control', 'public, max-age=3600');
        res.type('text/plain').send(
            paths.map((path) => (path ? `${baseUrl}/${path}` : baseUrl)).join('\n')
        );
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
    }
});

/**
 * Gallery photos come from src/a/images/gallery/<year>/, with small previews generated into
 * gallery-thumbs/<year>/<name>.webp by scripts/gallery-thumbnails.sh. The files only change on
 * deploy, so the list is built once per server.
 */
interface GalleryPhoto {
    url: string;
    thumbnail: string;
    year: string;
}
let galleryPhotos: Promise<GalleryPhoto[]> | undefined;

async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
    // In development the server runs from source; after a build, assets live in ../browser.
    const isDev = !import.meta.dirname.includes('/dist/');
    const imagesFolder = isDev
        ? join(import.meta.dirname, '../../../src/a/images/')
        : join(import.meta.dirname, '../browser/a/images/');
    const years = await fs.readdir(join(imagesFolder, 'gallery'));
    const perYear = await Promise.all(
        years.map(async (year) => {
            const files = await fs.readdir(join(imagesFolder, 'gallery', year));
            const thumbs = new Set(
                await fs.readdir(join(imagesFolder, 'gallery-thumbs', year)).catch(() => [])
            );
            return files.map((file) => {
                const thumb = file.replace(/\.[^.]+$/, '.webp');
                const url = `/a/images/gallery/${year}/${file}`;
                return {
                    url,
                    thumbnail: thumbs.has(thumb) ? `/a/images/gallery-thumbs/${year}/${thumb}` : url,
                    year,
                };
            });
        })
    );
    return perYear.flat();
}

app.get('/api/gallery', async (req, res) => {
    try {
        galleryPhotos ??= listGalleryPhotos();
        res.set('Cache-Control', 'public, max-age=3600');
        res.json(await galleryPhotos);
    } catch (error) {
        galleryPhotos = undefined;
        console.error('Error listing gallery photos:', error);
        res.status(500).json({ error: 'Unable to load the photo gallery' });
    }
});

/**
 * Copies this year's Eventbrite orders into burndown/<year>/orders for the admin burndown chart.
 * Only anonymous fields are kept: the order's day and time (Central), ticket count, and ticket
 * price paid (after discounts, excluding fees and tax). Refunded and cancelled tickets are left out, including single
 * tickets refunded from an order Eventbrite still reports as placed.
 *
 * The caller's Firebase ID token is passed through to the database, so the database rules decide
 * who may run it (admins only) and the server needs no Google credentials of its own. The
 * Eventbrite private token comes from the EVENTBRITE_TOKEN secret (or .env in development).
 */
/**
 * What the buyer paid for the tickets themselves. base_price is the list price before discount
 * codes, and gross includes Eventbrite fees when they're passed on to the buyer, so the lower of
 * the two is the ticket price actually paid.
 */
function ticketPrice({ costs }: EventbriteOrder) {
    const value = (cost: { major_value: string }) => Number(cost.major_value);
    return Math.min(value(costs.base_price), value(costs.gross) - value(costs.tax));
}

interface EventbriteOrder {
    created: string;
    status: string;
    costs: Record<'base_price' | 'gross' | 'tax', { major_value: string }>;
    attendees: { refunded: boolean; cancelled: boolean }[];
}

app.post('/api/admin/burndown/update', async (req, res) => {
    try {
        const idToken = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
        if (!idToken) {
            res.status(401).json({ error: 'Sign in first' });
            return;
        }
        const db = (path: string, init?: RequestInit) =>
            fetch(`${environment.firebaseConfig.databaseURL}/${path}.json?auth=${idToken}`, init);

        // Only admins can read /admin, so this doubles as the permission check.
        if ((await db('admin')).status !== 200) {
            res.status(403).json({ error: 'Only admins can update the burndown' });
            return;
        }

        if (!process.env['EVENTBRITE_TOKEN']) {
            try {
                process.loadEnvFile();
            } catch {}
        }
        const ebToken = process.env['EVENTBRITE_TOKEN'];
        if (!ebToken) {
            res.status(500).json({ error: 'EVENTBRITE_TOKEN is not configured' });
            return;
        }

        const orders: { day: string; time: string; tickets: number; price: number }[] = [];
        let continuation = '';
        do {
            const response = await fetch(
                `https://www.eventbriteapi.com/v3/events/${environment.eventbriteEventId}/orders/` +
                    `?expand=attendees${continuation ? `&continuation=${continuation}` : ''}`,
                { headers: { Authorization: `Bearer ${ebToken}` } }
            );
            if (!response.ok) {
                throw new Error(`Eventbrite responded with ${response.status}: ${await response.text()}`);
            }
            const page: {
                orders: EventbriteOrder[];
                pagination: { has_more_items: boolean; continuation?: string };
            } = await response.json();
            for (const order of page.orders) {
                const tickets = order.attendees.filter((a) => !a.refunded && !a.cancelled).length;
                if (order.status !== 'placed' || !tickets) continue;
                // Partly refunded orders keep the price of the tickets that are left.
                const price = (ticketPrice(order) * tickets) / order.attendees.length;
                // TZ is America/Chicago (set above), so local date parts are Central time.
                const created = new Date(order.created);
                orders.push({
                    day: created.toLocaleDateString('en-CA'),
                    time: created.toTimeString().slice(0, 5),
                    tickets,
                    price: Math.round(price * 100) / 100,
                });
            }
            continuation = page.pagination.has_more_items ? (page.pagination.continuation ?? '') : '';
        } while (continuation);
        orders.sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));

        const updatedAt = new Date().toISOString();
        const write = await db(`burndown/${environment.year}`, {
            method: 'PATCH',
            body: JSON.stringify({ orders, updatedAt, eventDate: environment.eventDate }),
        });
        if (!write.ok) {
            throw new Error(`Firebase responded with ${write.status}: ${await write.text()}`);
        }
        res.json({ orders: orders.length, updatedAt });
    } catch (error) {
        console.error('Error updating burndown:', error);
        res.status(502).json({ error: 'Unable to update from Eventbrite' });
    }
});

/**
 * Serve static files from /browser
 */
app.use(
    express.static(browserDistFolder, {
        maxAge: '1y',
        index: false,
        redirect: false,
    })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
    angularApp
        .handle(req)
        .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
        .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
    const port = process.env['PORT'] || 4000;
    app.listen(port, (error) => {
        if (error) {
            throw error;
        }

        console.log(`Node.js version: ${process.version}`);
        console.log(`Node Express server listening on http://localhost:${port}`);
    });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
