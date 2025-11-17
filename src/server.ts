import {
    AngularNodeAppEngine,
    createNodeRequestHandler,
    isMainModule,
    writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';

// Set timezone to Central Time for SSR
process.env.TZ = 'America/Chicago';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
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

app.use((req, res, next) => {
    res.set('X-Test-Header', 'Working');
    next();
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Generate sitemap.txt with all public URLs
 */
app.get('/sitemap.txt', async (req, res) => {
    try {
        const baseUrl = 'https://devfest.mn';
        const urls: string[] = [];

        // Static pages
        urls.push(baseUrl);
        urls.push(`${baseUrl}/schedule`);
        urls.push(`${baseUrl}/speakers`);
        urls.push(`${baseUrl}/gallery`);

        // Fetch Firebase data
        const firebaseUrl = 'https://devfestmn-2025-default-rtdb.firebaseio.com/devfest2025.json';
        const response = await fetch(firebaseUrl);
        const data = await response.json();

        // Add session URLs (schedule/:id/:seo)
        if (data.schedule) {
            Object.keys(data.schedule).forEach((sessionKey) => {
                const session = data.schedule[sessionKey];
                if (session.title) {
                    const seoTitle = session.title
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    urls.push(`${baseUrl}/schedule/${sessionKey}/${seoTitle}`);
                }
            });
        }

        // Add speaker URLs (speakers/:id/:seo)
        if (data.speakers) {
            Object.keys(data.speakers).forEach((speakerKey) => {
                const speaker = data.speakers[speakerKey];
                if (speaker.name) {
                    const seoName = speaker.name
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                    urls.push(`${baseUrl}/speakers/${speakerKey}/${seoName}`);
                }
            });
        }

        // Return as plain text
        res.setHeader('Content-Type', 'text/plain');
        res.send(urls.join('\n'));
    } catch (error) {
        console.error('Error generating sitemap:', error);
        res.status(500).send('Error generating sitemap');
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
