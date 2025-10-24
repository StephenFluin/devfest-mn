import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    // { path: 'auth', renderMode: RenderMode.Client },
    { path: 'speakers', renderMode: RenderMode.Server },
    { path: 'schedule', renderMode: RenderMode.Server },
    { path: '', renderMode: RenderMode.Prerender },
    { path: '**', renderMode: RenderMode.Server },
];
