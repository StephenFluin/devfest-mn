import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr/node';
import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
    const server = express();
    const serverDistFolder = dirname(fileURLToPath(import.meta.url));
    const browserDistFolder = resolve(serverDistFolder, '../browser');
    const indexHtml = join(serverDistFolder, 'index.server.html');

    const commonEngine = new CommonEngine();

    // Enable compression middleware
    server.use(
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

    server.set('view engine', 'html');
    server.set('views', browserDistFolder);

    // Example Express Rest API endpoints
    // server.get('/api/**', (req, res) => { });
    // Serve static files from /browser
    server.get(
        '*.*',
        express.static(browserDistFolder, {
            maxAge: '1y',
        })
    );

    // All regular routes use the Angular engine
    server.get('*', (req, res, next) => {
        const { protocol, originalUrl, baseUrl, headers } = req;

        commonEngine
            .render({
                bootstrap,
                documentFilePath: indexHtml,
                url: `${protocol}://${headers.host}${originalUrl}`,
                publicPath: browserDistFolder,
                providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
            })
            .then((html) => {
                console.log('server.ts is building ' + originalUrl);
                res.send(html);
            })
            .catch((err) => next(err));
    });

    return server;
}

function run(): void {
    const port = process.env['PORT'] || 4000;

    // Start up the Node server
    const server = app();
    server.listen(port, () => {
        console.log(`Node Express server listening on http://localhost:${port}`);
    });
}

run();
