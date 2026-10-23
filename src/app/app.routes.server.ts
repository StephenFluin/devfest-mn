import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'admin', renderMode: RenderMode.Client },
  // Admin pages sit behind a canMatch guard that needs the signed-in user, which only exists in
  // the browser, so the server must not try to match them (it would 404 on reload).
  { path: 'admin/**', renderMode: RenderMode.Client },
  // Speakers sign in (anonymously) to edit, which only happens in the browser.
  { path: 'speaker-edit/**', renderMode: RenderMode.Client },
  { path: 'speakers', renderMode: RenderMode.Server },
  { path: 'schedule', renderMode: RenderMode.Server },
  // Rendered per request: it lists confirmed speakers and opens and closes the CFP by date, so a
  // copy built at deploy time would go stale.
  { path: '', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
  { path: 'tickets', renderMode: RenderMode.Client },
];
