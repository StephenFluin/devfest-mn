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
