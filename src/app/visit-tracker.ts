import { storedAttribution } from './analytics.util';
import { CAMPAIGN_FIELDS, VisitEvent } from './shared/visit-session';

/**
 * Browser half of the first-party visit analytics (see src/visit-analytics.ts). A visit ends after
 * 30 minutes without a page view, like Google Analytics sessions.
 */
const SESSION_KEY = 'visit-session';
const SESSION_TIMEOUT = 30 * 60 * 1000;
/** Seconds the page must be visible for a single-page visit to count as engaged. */
const ENGAGED_AFTER = 10;

interface Session {
  sid: string;
  last: number;
  pages: number;
  engaged: boolean;
}

/** Kept in memory too, for browsers where localStorage throws. */
let session: Session | undefined;

/** Call after every completed navigation, including the first page load. */
export function trackPageView(path: string) {
  const current = activeSession();
  if (current) {
    session = { ...current, last: Date.now(), pages: current.pages + 1 };
    send({ type: 'page', sid: session.sid, pages: session.pages });
    save();
    if (session.pages >= 2) markEngaged();
  } else {
    startSession(path);
  }
}

/** Call when an Eventbrite checkout completes. */
export function trackVisitPurchase(orderId: unknown) {
  if (!activeSession()) startSession(location.pathname);
  session = { ...session!, last: Date.now(), engaged: true };
  save();
  send({ type: 'purchase', sid: session.sid, order: String(orderId) });
}

/** Call when the visitor follows a link to the external call for papers form. */
export function trackVisitCfp() {
  if (!activeSession()) startSession(location.pathname);
  session = { ...session!, last: Date.now(), engaged: true };
  save();
  send({ type: 'cfp', sid: session.sid });
}

function startSession(path: string) {
  session = {
    sid: crypto.randomUUID().replace(/-/g, ''),
    last: Date.now(),
    pages: 1,
    engaged: false,
  };
  save();
  const attribution = storedAttribution();
  const campaign = Object.fromEntries(
    CAMPAIGN_FIELDS.filter((field) => attribution[field]).map((field) => [
      field,
      attribution[field],
    ]),
  );
  send({ type: 'visit', sid: session.sid, ...campaign, referrer: referrerHost(), landing: path });
  countVisibleTime(session.sid);
}

function markEngaged() {
  if (!session || session.engaged) return;
  session = { ...session, engaged: true };
  save();
  send({ type: 'engaged', sid: session.sid });
}

function countVisibleTime(sid: string) {
  let seconds = 0;
  const timer = setInterval(() => {
    if (session?.sid !== sid || session.engaged) {
      clearInterval(timer);
    } else if (document.visibilityState === 'visible' && ++seconds >= ENGAGED_AFTER) {
      clearInterval(timer);
      markEngaged();
    }
  }, 1000);
}

function activeSession(): Session | undefined {
  let stored: Session | undefined;
  try {
    stored = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') ?? undefined;
  } catch {}
  const latest = stored ?? session;
  return latest && Date.now() - latest.last < SESSION_TIMEOUT ? latest : undefined;
}

function save() {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function referrerHost() {
  try {
    const host = new URL(document.referrer).hostname;
    return host === location.hostname ? undefined : host.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function send(event: VisitEvent) {
  const body = JSON.stringify(event);
  // sendBeacon survives the page closing, so a quick bounce still records the visit.
  if (!navigator.sendBeacon?.('/api/visit', body)) {
    fetch('/api/visit', { method: 'POST', body, keepalive: true }).catch(() => {});
  }
}
