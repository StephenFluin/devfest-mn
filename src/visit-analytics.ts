import express, { type Express } from 'express';
import { environment } from './environments/environment';
import { CAMPAIGN_FIELDS, ORDER_ID, SESSION_ID, VisitSession } from './app/shared/visit-session';
import { UntypedJson } from './app/shared/untyped-json';

/**
 * First-party visit analytics for the admin UTM funnel (Visit → Engaged → Ticket sale or CFP click). Browsers
 * POST small events to /api/visit and this writes them to analytics/<year>/sessions/<id>.
 *
 * Writes use the server's own Google identity (the App Hosting service account, from the Cloud Run
 * metadata server), which the database rules don't apply to, so the rules can keep refusing all
 * writes from browsers. Locally there's no metadata server: set FIREBASE_DATABASE_EMULATOR_HOST to
 * write to the Realtime Database emulator, or events are dropped.
 */
export function addVisitAnalytics(app: Express) {
  app.post('/api/visit', express.text({ type: () => true, limit: '2kb' }), async (req, res) => {
    try {
      if (!allowEvent() || BOTS.test(req.headers['user-agent'] ?? '')) {
        res.status(204).end();
        return;
      }
      let event: UntypedJson;
      try {
        event = JSON.parse(req.body);
      } catch {
        // Not JSON; sessionUpdate rejects it below.
      }
      const update = sessionUpdate(event);
      if (!update) {
        res.status(400).end();
        return;
      }
      await writeSession(event.sid, update);
      res.status(204).end();
    } catch (error) {
      console.error('Error saving visit analytics:', error);
      res.status(204).end();
    }
  });
}

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;
const clean = (value: unknown, max = 100) =>
  typeof value === 'string' ? value.trim().slice(0, max) || undefined : undefined;

/** The fields to merge into the stored session for one event, or null if the event is invalid. */
export function sessionUpdate(event: UntypedJson, now = new Date()): Partial<VisitSession> | null {
  if (!event || typeof event !== 'object' || !SESSION_ID.test(event.sid)) {
    return null;
  }
  switch (event.type) {
    case 'visit': {
      const update: Partial<VisitSession> = {
        start: now.getTime(),
        day: now.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }),
        pages: 1,
      };
      for (const field of CAMPAIGN_FIELDS) {
        const value = clean(event[field]);
        if (value) update[field] = value;
      }
      const referrer = clean(event.referrer, 253)?.toLowerCase();
      if (referrer && /^[a-z0-9.-]+$/.test(referrer)) update.referrer = referrer;
      const landing = clean(event.landing, 200);
      if (landing?.startsWith('/')) update.landing = landing;
      return update;
    }
    case 'page':
      return Number.isInteger(event.pages) && event.pages > 0
        ? { pages: Math.min(event.pages, 500) }
        : null;
    case 'engaged':
      return { engaged: true };
    case 'purchase':
      // A multi-path update, so several orders in one visit are all kept.
      return ORDER_ID.test(event.order)
        ? ({ engaged: true, [`orders/${event.order}`]: true } as Partial<VisitSession>)
        : null;
    case 'cfp':
      return { engaged: true, cfp: true };
  }
  return null;
}

/** One shared cap per server instance keeps a flood of fake events from piling into the database. */
const eventLimit = { windowMs: 60_000, max: 1200, recent: [] as number[] };
function allowEvent() {
  const now = Date.now();
  eventLimit.recent = eventLimit.recent.filter((t) => now - t < eventLimit.windowMs);
  if (eventLimit.recent.length >= eventLimit.max) return false;
  eventLimit.recent.push(now);
  return true;
}

async function writeSession(sid: string, update: Partial<VisitSession>) {
  const path = `analytics/${environment.year}/sessions/${sid}.json`;
  const emulator = process.env['FIREBASE_DATABASE_EMULATOR_HOST'];
  let url: string;
  let token: string;
  if (emulator) {
    const namespace = new URL(environment.firebaseConfig.databaseURL).hostname.split('.')[0];
    url = `http://${emulator}/${path}?ns=${namespace}`;
    token = 'owner';
  } else {
    url = `${environment.firebaseConfig.databaseURL}/${path}`;
    const access = await accessToken();
    if (!access) return;
    token = access;
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(update),
  });
  if (!response.ok) {
    throw new Error(`Firebase responded with ${response.status}: ${await response.text()}`);
  }
}

const METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' +
  '?scopes=https://www.googleapis.com/auth/firebase.database,https://www.googleapis.com/auth/userinfo.email';
let cachedToken: { value: string; expires: number } | undefined;
let noCredentials = false;

/** An OAuth token for the service account the server runs as, or undefined off Google Cloud. */
async function accessToken(): Promise<string | undefined> {
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  if (noCredentials) return undefined;
  let response: Response;
  try {
    response = await fetch(METADATA_TOKEN_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    noCredentials = true;
    console.warn(
      'Visit analytics are not being saved: no Google credentials here. ' +
        'Set FIREBASE_DATABASE_EMULATOR_HOST to test them locally.',
    );
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`Metadata server responded with ${response.status}`);
  }
  const { access_token, expires_in } = await response.json();
  cachedToken = { value: access_token, expires: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}
