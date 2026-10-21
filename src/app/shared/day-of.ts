import { environment } from '../../environments/environment';
import { eventUtcOffset } from './event-data';
import { serverAgreedClock } from './server-clock';

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

/** Whether to show day-of details, agreed between server and browser. */
export function dayOf() {
  return serverAgreedClock('dayOf', () => isDayOf(), false);
}
