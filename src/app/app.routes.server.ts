import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    { path: 'admin', renderMode: RenderMode.Client },
    // Admin pages sit behind a canMatch guard that needs the signed-in user, which only exists in
    // the browser, so the server must not try to match them (it would 404 on reload).
    { path: 'admin/**', renderMode: RenderMode.Client },
    { path: 'speakers', renderMode: RenderMode.Server },
    { path: 'schedule', renderMode: RenderMode.Server },
    { path: '', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Server },
    { path: 'tickets', renderMode: RenderMode.Client },
];
