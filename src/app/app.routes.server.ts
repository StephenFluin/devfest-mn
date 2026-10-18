import { RenderMode, ServerRoute } from '@angular/ssr';
import { environment } from '../environments/environment';

export const serverRoutes: ServerRoute[] = [
    { path: 'admin', renderMode: RenderMode.Client },
    // Admin pages sit behind a canMatch guard that needs the signed-in user, which only exists in
    // the browser, so the server must not try to match them (it would 404 on reload).
    { path: 'admin/**', renderMode: RenderMode.Client },
    { path: 'speakers', renderMode: RenderMode.Server },
    { path: 'schedule', renderMode: RenderMode.Server },
    // Once speakers are announced the home page lists them, so render it per request to pick up
    // speakers added after the last deploy.
    environment.showSpeakers
        ? { path: '', renderMode: RenderMode.Server }
        : { path: '', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Server },
    { path: 'tickets', renderMode: RenderMode.Client },
];
