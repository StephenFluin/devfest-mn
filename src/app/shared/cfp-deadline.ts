import { afterNextRender, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { centralUtcOffset } from './event-data';
import { serverAgreedClock } from './server-clock';

/**
 * Submissions close at 11:59pm Central on environment.cfpCloses. Leave cfpCloses unset (null) until
 * the year's call for speakers is announced.
 */
export const cfpDeadline = environment.cfpCloses
  ? new Date(`${environment.cfpCloses}T23:59:59${centralUtcOffset(environment.cfpCloses)}`)
  : null;

/** Not announced yet (no close date), open, or closed (past the close date). */
export type CfpState = 'unannounced' | 'open' | 'closed';

export function cfpStateAt(now = Date.now()): CfpState {
  if (!cfpDeadline) return 'unannounced';
  return now <= cfpDeadline.getTime() ? 'open' : 'closed';
}

/** The call for speakers' state, agreed between server and browser. */
export function cfpState() {
  return serverAgreedClock<CfpState>('cfpState', () => cfpStateAt(), 'unannounced');
}

/**
 * "12 days left", "Last day", or null once closed. Computed in the browser only, because the
 * home page is prerendered at build time and a server-side count would go stale.
 */
export function cfpCountdown() {
  const label = signal<string | null>(null);
  afterNextRender(() => {
    if (!cfpDeadline) return;
    const msLeft = cfpDeadline.getTime() - Date.now();
    if (msLeft < 0) {
      return;
    }
    const days = Math.floor(msLeft / 86_400_000);
    label.set(days === 0 ? 'Last day to submit' : `${days} ${days === 1 ? 'day' : 'days'} left`);
  });
  return label.asReadonly();
}
