import { afterNextRender, signal } from '@angular/core';
import { environment } from '../../environments/environment';

/** Submissions close at 11:59pm Central on the close date. */
export const cfpDeadline = new Date(`${environment.cfpCloses}T23:59:59-05:00`);

/**
 * "12 days left", "Last day", or null once closed. Computed in the browser only, because the
 * home page is prerendered at build time and a server-side count would go stale.
 */
export function cfpCountdown() {
    const label = signal<string | null>(null);
    afterNextRender(() => {
        const msLeft = cfpDeadline.getTime() - Date.now();
        if (msLeft < 0) {
            return;
        }
        const days = Math.floor(msLeft / 86_400_000);
        label.set(days === 0 ? 'Last day to submit' : `${days} ${days === 1 ? 'day' : 'days'} left`);
    });
    return label.asReadonly();
}
