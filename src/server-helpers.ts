import type { Request, Response as ExpressResponse } from 'express';
import { environment } from './environments/environment';
import { googleAccessToken } from './google-credentials';

/**
 * Shared pieces for the server's API routes: rate limits, the two ways of talking to the Realtime
 * Database, and reading the caller's Firebase ID token.
 */

/**
 * One shared cap per server instance. Each route gets its own, sized for how often real people use
 * it; the point is to stop anyone hammering the database or a third-party API through the server.
 */
export function rateLimiter(max: number, windowMs = 60_000, what = 'requests') {
  let recent: number[] = [];
  return (res: ExpressResponse): boolean => {
    const now = Date.now();
    recent = recent.filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      res.status(429).json({ error: `Too many ${what}, try again in a minute` });
      return false;
    }
    recent.push(now);
    return true;
  };
}

/** The Firebase ID token from an Authorization: Bearer header, if any. */
export function bearerToken(req: Request): string | undefined {
  return req.headers.authorization?.match(/^Bearer ([\w.-]+)$/)?.[1];
}

export type DatabaseFetch = (path: string, init?: RequestInit) => Promise<Response>;

/**
 * Database access as the signed-in admin: their ID token is passed through to the REST API, so the
 * database rules decide what they may read and write. The REST API only accepts ID tokens as
 * ?auth=, not in a header; the request goes straight to Firebase over HTTPS and isn't logged here.
 */
export function userDatabase(idToken: string): DatabaseFetch {
  return (path, init) =>
    fetch(
      `${environment.firebaseConfig.databaseURL}/${path}.json?auth=${encodeURIComponent(idToken)}`,
      init,
    );
}

/** Only admins can read /admin, so reading it doubles as the permission check. */
export async function isAdmin(db: DatabaseFetch): Promise<boolean> {
  return (await db('admin')).status === 200;
}

/**
 * Checks the caller is a signed-in admin and returns their database access, or answers the request
 * with 401/403 and returns undefined.
 */
export async function requireAdmin(
  req: Request,
  res: ExpressResponse,
  action: string,
): Promise<{ idToken: string; db: DatabaseFetch } | undefined> {
  const idToken = bearerToken(req);
  if (!idToken) {
    res.status(401).json({ error: 'Sign in first' });
    return undefined;
  }
  const db = userDatabase(idToken);
  if (!(await isAdmin(db))) {
    res.status(403).json({ error: `Only admins can ${action}` });
    return undefined;
  }
  return { idToken, db };
}

/** The Realtime Database emulator, when FIREBASE_DATABASE_EMULATOR_HOST points at one. */
function emulatorUrl(path: string): string | undefined {
  const emulator = process.env['FIREBASE_DATABASE_EMULATOR_HOST'];
  if (!emulator) return undefined;
  const namespace = new URL(environment.firebaseConfig.databaseURL).hostname.split('.')[0];
  return `http://${emulator}/${path}.json?ns=${namespace}`;
}

/** Reads a publicly readable path (one the rules open with ".read": true), with no credentials. */
export function publicDatabase(path: string): Promise<Response> {
  return fetch(emulatorUrl(path) ?? `${environment.firebaseConfig.databaseURL}/${path}.json`);
}

/**
 * Database access as the server itself (the App Hosting service account, which the rules don't
 * apply to), for paths browsers may not write. Undefined off Google Cloud unless
 * the emulator is configured.
 */
export async function serviceDatabase(): Promise<DatabaseFetch | undefined> {
  if (emulatorUrl('x')) {
    return (path, init) =>
      fetch(emulatorUrl(path), {
        ...init,
        headers: { ...init?.headers, Authorization: 'Bearer owner' },
      });
  }
  const access = await googleAccessToken();
  if (!access) return undefined;
  return (path, init) =>
    fetch(`${environment.firebaseConfig.databaseURL}/${path}.json`, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${access}` },
    });
}

/** Reads JSON from a database response, throwing on a non-2xx status. */
export async function readJson<T = unknown>(pending: Response | Promise<Response>): Promise<T> {
  const response = await pending;
  if (!response.ok) {
    throw new Error(`Firebase responded with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

/** Base URL of this year's Eventbrite API calls. */
export const EVENTBRITE_API = 'https://www.eventbriteapi.com/v3';

/** The Eventbrite private token, from the EVENTBRITE_TOKEN secret or .env in development. */
export function eventbriteToken(): string | undefined {
  if (!process.env['EVENTBRITE_TOKEN']) {
    try {
      process.loadEnvFile();
    } catch {
      // No .env file; callers report what's missing.
    }
  }
  return process.env['EVENTBRITE_TOKEN'];
}

export async function eventbrite<T = unknown>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${EVENTBRITE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Eventbrite responded with ${response.status}: ${await response.text()}`);
  }
  return response.json();
}
