import { afterNextRender, inject, makeStateKey, PLATFORM_ID, signal, TransferState } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { environment } from '../../environments/environment';
import { eventUtcOffset } from './event-data';

const DAY = 86_400_000;

/**
 * Day-of details (venue, parking, Wi-Fi, survey) show from the day before the event, when people
 * plan their trip, through a few days after, so the survey link stays easy to find.
 */
const showFrom = new Date(`${environment.eventDate}T00:00:00${eventUtcOffset}`).getTime() - DAY;
const showUntil = showFrom + (1 + 1 + 3) * DAY;

export function isDayOf(now = Date.now()) {
    return now >= showFrom && now < showUntil;
}

const DAY_OF_KEY = makeStateKey<boolean>('dayOf');

/**
 * Whether to show day-of details. The server decides when it renders the page and hands its answer
 * to the browser, so hydration sees the same page the server sent; the browser then checks its own
 * clock, which matters when the page was prerendered at build time.
 */
export function dayOf() {
    const transferState = inject(TransferState);
    const value = signal(false);
    if (isPlatformServer(inject(PLATFORM_ID))) {
        value.set(isDayOf());
        transferState.set(DAY_OF_KEY, value());
    } else {
        value.set(transferState.get(DAY_OF_KEY, false));
        afterNextRender(() => value.set(isDayOf()));
    }
    return value.asReadonly();
}
