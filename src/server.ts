import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import { environment } from './environments/environment';
import { slugify } from './app/shared/slug';
import { addVisitAnalytics } from './visit-analytics';
import { renderSpeakerCard } from './speaker-card';
import { createMailer } from './mailer';
import { googleAccessToken } from './google-credentials';
import { randomUUID } from 'node:crypto';
import { INVITE_TOKEN, inviteEmail } from './app/speaker-invite/invite-email';
import { calendarEvent, icsFile } from './app/shared/calendar';
import { cfpStateAt } from './app/shared/cfp-deadline';
import type { Session } from './app/shared/data.service';
import { UntypedJson } from './app/shared/untyped-json';

// Set timezone to Central Time for SSR
process.env['TZ'] = 'America/Chicago';

const browserDistFolder = join(import.meta.dirname, '../browser');
// In development the server runs from source; after a build, assets live in ../browser.
const imagesFolder = import.meta.dirname.includes('/dist/')
  ? join(import.meta.dirname, '../browser/a/images/')
  : join(import.meta.dirname, '../../../src/a/images/');

const app = express();
app.disable('x-powered-by');
const angularApp = new AngularNodeAppEngine();

app.use(
  compression({
    filter: (req, res) => {
      // Don't compress responses if the client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression for all other requests
      return compression.filter(req, res);
    },
    level: 6, // Compression level (1-9, where 9 is most compressed but slowest)
    threshold: 1024, // Only compress responses larger than 1KB
  }),
);

interface SitemapEntry {
  path: string;
  /** Last edit in the admin, in ms, when known. */
  updated?: number;
}

async function sitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = ['', 'gallery', 'past', 'conduct', 'refunds'].map((path) => ({
    path,
  }));
  if (cfpStateAt() === 'open') entries.push({ path: 'speaker-cfp' });
  if (environment.showSponsor) entries.push({ path: 'sponsors' });

  // Only schedule and speakers are public; the rest of the year is admin-only.
  const fetchPublic = async (child: 'schedule' | 'speakers') => {
    const response = await fetch(
      `${environment.firebaseConfig.databaseURL}/devfest${environment.year}/${child}.json`,
    );
    if (!response.ok) {
      throw new Error(`Firebase responded with ${response.status}`);
    }
    return Object.entries<UntypedJson>((await response.json()) ?? {});
  };
  const latest = (items: SitemapEntry[]) =>
    Math.max(0, ...items.map((item) => item.updated ?? 0)) || undefined;

  const [schedule, speakers] = await Promise.all([
    fetchPublic('schedule'),
    fetchPublic('speakers'),
  ]);
  // Speaker pages show their talks and session pages show their speakers, so each page changes
  // when either side is saved.
  const speakerUpdated = new Map(speakers.map(([key, speaker]) => [key, speaker.updatedAt ?? 0]));
  const sessionsOf = (speakerKey: string) =>
    schedule.filter(([, session]) => Object.values(session.speakers ?? {}).includes(speakerKey));

  if (environment.showSchedule) {
    const sessions = schedule
      .filter(([, session]) => session.title)
      .map(([key, session]) => ({
        path: `schedule/${key}/${slugify(session.title)}`,
        updated:
          Math.max(
            session.updatedAt ?? 0,
            ...Object.values<string>(session.speakers ?? {}).map(
              (speakerKey) => speakerUpdated.get(speakerKey) ?? 0,
            ),
          ) || undefined,
      }));
    entries.push({ path: 'schedule', updated: latest(sessions) }, ...sessions);
  }
  const speakerPages = speakers
    .filter(([, speaker]) => speaker.name && speaker.confirmed)
    .map(([key, speaker]) => ({
      path: `speakers/${key}/${slugify(speaker.name)}`,
      updated:
        Math.max(
          speaker.updatedAt ?? 0,
          ...sessionsOf(key).map(([, session]) => session.updatedAt ?? 0),
        ) || undefined,
    }));
  // Speakers are public once any are confirmed.
  if (speakerPages.length) {
    entries.push({ path: 'speakers', updated: latest(speakerPages) }, ...speakerPages);
    // The home page lists the speakers too.
    entries[0].updated = latest(speakerPages);
  }
  return entries;
}

const sitemapUrl = (path: string) =>
  path ? `${environment.siteUrl}/${path}` : environment.siteUrl;
const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * sitemap.xml lists the public pages that are switched on for the current phase of the event,
 * plus a page for every scheduled session and confirmed speaker once those are live. lastmod
 * comes from updatedAt, which the admin sets whenever a speaker or session is saved.
 */
app.get('/sitemap.xml', async (req, res) => {
  try {
    const urls = (await sitemapEntries()).map(
      ({ path, updated }) =>
        `  <url><loc>${escapeXml(sitemapUrl(path))}</loc>` +
        (updated ? `<lastmod>${new Date(updated).toISOString()}</lastmod>` : '') +
        '</url>',
    );
    res.set('Cache-Control', 'public, max-age=3600');
    res
      .type('application/xml')
      .send(
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.join('\n') +
          '\n</urlset>\n',
      );
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/** The older plain-text sitemap, kept for anything that still points at it. */
app.get('/sitemap.txt', async (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res
      .type('text/plain')
      .send((await sitemapEntries()).map(({ path }) => sitemapUrl(path)).join('\n'));
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

/**
 * Short share links for speakers: /s/<name-slug> sends people to the speaker's page, tagged so the
 * admin UTM funnel credits the speaker (utm_source=speaker, utm_campaign=speaker_<slug>). A 302
 * rather than a 301, because browsers cache 301s forever and the destination or tags may change.
 * Unknown names go to the speakers page.
 */
let speakerSlugs: { at: number; slugs: Promise<Map<string, string>> } | undefined;

async function loadSpeakerSlugs(): Promise<Map<string, string>> {
  const response = await fetch(
    `${environment.firebaseConfig.databaseURL}/devfest${environment.year}/speakers.json`,
  );
  if (!response.ok) {
    throw new Error(`Firebase responded with ${response.status}`);
  }
  const speakers: Record<string, { name?: string; confirmed?: boolean }> =
    (await response.json()) ?? {};
  return new Map(
    Object.entries(speakers)
      .filter(([, speaker]) => speaker.name && speaker.confirmed)
      .map(([key, speaker]) => [slugify(speaker.name), key]),
  );
}

app.get('/s/:slug', async (req, res) => {
  try {
    // Cached briefly so a new speaker's link works within a minute of being confirmed.
    if (!speakerSlugs || Date.now() - speakerSlugs.at > 60_000) {
      speakerSlugs = { at: Date.now(), slugs: loadSpeakerSlugs() };
    }
    const slug = slugify(req.params.slug);
    const key = (await speakerSlugs.slugs).get(slug);
    res.set('Cache-Control', 'no-store');
    if (!key) {
      res.redirect(302, '/speakers');
      return;
    }
    const params = new URLSearchParams({
      utm_source: 'speaker',
      utm_medium: 'social',
      utm_campaign: `speaker_${slug}`,
    });
    res.redirect(302, `/speakers/${key}/${slug}?${params}`);
  } catch (error) {
    speakerSlugs = undefined;
    console.error('Error resolving speaker link:', error);
    res.redirect(302, '/speakers');
  }
});

/**
 * A session as a calendar file, /calendar/<key>.ics, for Apple Calendar and Outlook. iOS opens it
 * straight into an "Add to Calendar" sheet. Built from the whole schedule, because a session's end
 * is the next session in its room.
 */
app.get('/calendar/:file', async (req, res) => {
  const key = req.params.file.match(/^([A-Za-z0-9_-]{1,40})\.ics$/)?.[1];
  if (!key) {
    res.status(404).end();
    return;
  }
  try {
    const response = await fetch(
      `${environment.firebaseConfig.databaseURL}/devfest${environment.year}/schedule.json`,
    );
    if (!response.ok) {
      throw new Error(`Firebase responded with ${response.status}`);
    }
    const schedule: Session[] = Object.entries<Session>((await response.json()) ?? {}).map(
      ([$key, session]) => ({ ...session, $key }),
    );
    const session = schedule.find((item) => item.$key === key);
    const event = session && calendarEvent(session, schedule);
    if (!event) {
      res.status(404).end();
      return;
    }
    // Short, so a moved session reaches people who add it later.
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Content-Disposition', `inline; filename="${slugify(session.title)}.ics"`);
    res.type('text/calendar; charset=utf-8').send(icsFile(event));
  } catch (error) {
    console.error('Error building calendar file:', error);
    res.status(500).end();
  }
});

/**
 * Share card for a confirmed speaker, /og/speakers/<key>.png. Speaker pages link it with
 * ?v=<latest updatedAt of the speaker and their sessions>, so an edit gives a new URL and the CDN
 * can keep each version for a day. Cards are cached per speaker and re-rendered only when that
 * version changes, so made-up ?v values can't force renders.
 */
const cards = new Map<string, { version: number; png: Promise<Uint8Array> }>();

async function speakerCardData(key: string) {
  const base = `${environment.firebaseConfig.databaseURL}/devfest${environment.year}`;
  const [speaker, schedule] = await Promise.all(
    [`${base}/speakers/${encodeURIComponent(key)}.json`, `${base}/schedule.json`].map(
      async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Firebase responded with ${response.status}`);
        return response.json();
      },
    ),
  );
  if (!speaker?.confirmed || !speaker.name) return null;
  const sessions = Object.values<UntypedJson>(schedule ?? {}).filter((session) =>
    Object.values(session.speakers ?? {}).includes(key),
  );
  return {
    // Matches the version speaker pages put in the URL (speaker-full.component.ts).
    version: Math.max(speaker.updatedAt ?? 0, ...sessions.map((session) => session.updatedAt ?? 0)),
    speaker: {
      name: speaker.name,
      company: speaker.company,
      imageUrl: speaker.imageUrl,
      talks: sessions.map((session) => session.title).filter(Boolean),
    },
  };
}

app.get('/og/speakers/:file', async (req, res) => {
  const key = req.params.file.match(/^([A-Za-z0-9_-]{1,40})\.png$/)?.[1];
  if (!key) {
    res.status(404).end();
    return;
  }
  try {
    const requested = String(req.query['v'] ?? '');
    let card = cards.get(key);
    if (!card || String(card.version) !== requested) {
      const data = await speakerCardData(key);
      if (!data) {
        cards.delete(key);
        res.status(404).end();
        return;
      }
      if (!card || card.version !== data.version) {
        if (cards.size >= 200) cards.clear();
        card = { version: data.version, png: renderSpeakerCard(data.speaker, imagesFolder) };
        cards.set(key, card);
      }
    }
    const png = await card.png;
    // Long caching only for the current version's URL; anything else may change.
    res.set(
      'Cache-Control',
      String(card.version) === requested ? 'public, max-age=86400' : 'public, max-age=600',
    );
    res.type('image/png').send(Buffer.from(png));
  } catch (error) {
    cards.delete(key);
    console.error('Error rendering speaker card:', error);
    res.status(500).end();
  }
});

/**
 * Gallery photos come from src/a/images/gallery/<year>/, with small previews generated into
 * gallery-thumbs/<year>/<name>.webp by scripts/gallery-thumbnails.sh. The files only change on
 * deploy, so the list is built once per server.
 */
interface GalleryPhoto {
  url: string;
  thumbnail: string;
  year: string;
}
let galleryPhotos: Promise<GalleryPhoto[]> | undefined;

async function listGalleryPhotos(): Promise<GalleryPhoto[]> {
  const years = await fs.readdir(join(imagesFolder, 'gallery'));
  const perYear = await Promise.all(
    years.map(async (year) => {
      const files = await fs.readdir(join(imagesFolder, 'gallery', year));
      const thumbs = new Set(
        await fs.readdir(join(imagesFolder, 'gallery-thumbs', year)).catch(() => []),
      );
      return files.map((file) => {
        const thumb = file.replace(/\.[^.]+$/, '.webp');
        const url = `/a/images/gallery/${year}/${file}`;
        return {
          url,
          thumbnail: thumbs.has(thumb) ? `/a/images/gallery-thumbs/${year}/${thumb}` : url,
          year,
        };
      });
    }),
  );
  return perYear.flat();
}

app.get('/api/gallery', async (req, res) => {
  try {
    galleryPhotos ??= listGalleryPhotos();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(await galleryPhotos);
  } catch (error) {
    galleryPhotos = undefined;
    console.error('Error listing gallery photos:', error);
    res.status(500).json({ error: 'Unable to load the photo gallery' });
  }
});

/**
 * Copies this year's Eventbrite orders into burndown/<year>/orders for the admin burndown chart.
 * Only anonymous fields are kept: the order's day and time (Central), ticket count, and ticket
 * price paid (after discounts, excluding fees and tax). Refunded and cancelled tickets are left out, including single
 * tickets refunded from an order Eventbrite still reports as placed.
 *
 * The caller's Firebase ID token is passed through to the database, so the database rules decide
 * who may run it (admins only) and the server needs no Google credentials of its own. The
 * Eventbrite private token comes from the EVENTBRITE_TOKEN secret (or .env in development).
 */
/**
 * What the buyer paid for the tickets themselves. base_price is the list price before discount
 * codes, and gross includes Eventbrite fees when they're passed on to the buyer, so the lower of
 * the two is the ticket price actually paid.
 */
function ticketPrice({ costs }: EventbriteOrder) {
  const value = (cost: { major_value: string }) => Number(cost.major_value);
  return Math.min(value(costs.base_price), value(costs.gross) - value(costs.tax));
}

interface EventbriteOrder {
  created: string;
  status: string;
  costs: Record<'base_price' | 'gross' | 'tax', { major_value: string }>;
  attendees: { refunded: boolean; cancelled: boolean }[];
}

/**
 * Only a few admins ever run the update, so one shared limit per server instance is enough to stop
 * anyone hammering the database and Eventbrite through it.
 */
const burndownLimit = { windowMs: 60_000, max: 5, recent: [] as number[] };

app.post('/api/admin/burndown/update', async (req, res) => {
  try {
    const now = Date.now();
    burndownLimit.recent = burndownLimit.recent.filter((t) => now - t < burndownLimit.windowMs);
    if (burndownLimit.recent.length >= burndownLimit.max) {
      res.set('Retry-After', String(Math.ceil(burndownLimit.windowMs / 1000)));
      res.status(429).json({ error: 'Too many updates, try again in a minute' });
      return;
    }
    burndownLimit.recent.push(now);

    const idToken = req.headers.authorization?.match(/^Bearer ([\w.-]+)$/)?.[1];
    if (!idToken) {
      res.status(401).json({ error: 'Sign in first' });
      return;
    }
    // The REST API only accepts Firebase ID tokens as ?auth=, not in a header. This request
    // goes straight to Firebase over HTTPS and its URL is never logged here.
    const db = (path: string, init?: RequestInit) =>
      fetch(
        `${environment.firebaseConfig.databaseURL}/${path}.json?auth=${encodeURIComponent(idToken)}`,
        init,
      );

    // Only admins can read /admin, so this doubles as the permission check.
    if ((await db('admin')).status !== 200) {
      res.status(403).json({ error: 'Only admins can update the burndown' });
      return;
    }

    if (!process.env['EVENTBRITE_TOKEN']) {
      try {
        process.loadEnvFile();
      } catch {
        // No .env file; the token check below reports what's missing.
      }
    }
    const ebToken = process.env['EVENTBRITE_TOKEN'];
    if (!ebToken) {
      res.status(500).json({ error: 'EVENTBRITE_TOKEN is not configured' });
      return;
    }

    const orders: { day: string; time: string; tickets: number; price: number }[] = [];
    let continuation = '';
    do {
      const response = await fetch(
        `https://www.eventbriteapi.com/v3/events/${environment.eventbriteEventId}/orders/` +
          `?expand=attendees${continuation ? `&continuation=${continuation}` : ''}`,
        { headers: { Authorization: `Bearer ${ebToken}` } },
      );
      if (!response.ok) {
        throw new Error(`Eventbrite responded with ${response.status}: ${await response.text()}`);
      }
      const page: {
        orders: EventbriteOrder[];
        pagination: { has_more_items: boolean; continuation?: string };
      } = await response.json();
      for (const order of page.orders) {
        const tickets = order.attendees.filter((a) => !a.refunded && !a.cancelled).length;
        if (order.status !== 'placed' || !tickets) continue;
        // Partly refunded orders keep the price of the tickets that are left.
        const price = (ticketPrice(order) * tickets) / order.attendees.length;
        // TZ is America/Chicago (set above), so local date parts are Central time.
        const created = new Date(order.created);
        orders.push({
          day: created.toLocaleDateString('en-CA'),
          time: created.toTimeString().slice(0, 5),
          tickets,
          price: Math.round(price * 100) / 100,
        });
      }
      continuation = page.pagination.has_more_items ? (page.pagination.continuation ?? '') : '';
    } while (continuation);
    orders.sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`));

    const updatedAt = new Date().toISOString();
    const write = await db(`burndown/${environment.year}`, {
      method: 'PATCH',
      body: JSON.stringify({ orders, updatedAt, eventDate: environment.eventDate }),
    });
    if (!write.ok) {
      throw new Error(`Firebase responded with ${write.status}: ${await write.text()}`);
    }
    res.json({ orders: orders.length, updatedAt });
  } catch (error) {
    console.error('Error updating burndown:', error);
    res.status(502).json({ error: 'Unable to update from Eventbrite' });
  }
});

/** Invites are sent one at a time by admins, so a small shared limit stops runaway sends. */
const inviteLimit = { windowMs: 60_000, max: 10, recent: [] as number[] };

/**
 * Emails a speaker the edit link for an invite the admin already created at
 * speakerInvites/<token>. Like the burndown update, the caller's ID token is passed through to
 * the database, so the rules decide who may send (admins only).
 */
app.post('/api/admin/speaker-invites/:token/email', async (req, res) => {
  try {
    const now = Date.now();
    inviteLimit.recent = inviteLimit.recent.filter((t) => now - t < inviteLimit.windowMs);
    if (inviteLimit.recent.length >= inviteLimit.max) {
      res.set('Retry-After', String(Math.ceil(inviteLimit.windowMs / 1000)));
      res.status(429).json({ error: 'Too many invites, try again in a minute' });
      return;
    }
    inviteLimit.recent.push(now);

    const token = req.params.token;
    const idToken = req.headers.authorization?.match(/^Bearer ([\w.-]+)$/)?.[1];
    if (!idToken) {
      res.status(401).json({ error: 'Sign in first' });
      return;
    }
    if (!INVITE_TOKEN.test(token)) {
      res.status(400).json({ error: 'Not an invite token' });
      return;
    }
    const db = (path: string, init?: RequestInit) =>
      fetch(
        `${environment.firebaseConfig.databaseURL}/${path}.json?auth=${encodeURIComponent(idToken)}`,
        init,
      );

    // Anyone may read a single invite, so check for an admin separately.
    if ((await db('admin')).status !== 200) {
      res.status(403).json({ error: 'Only admins can send invites' });
      return;
    }
    const invitePath = `devfest${environment.year}/speakerInvites/${token}`;
    const invite = await (await db(invitePath)).json();
    if (!invite?.email) {
      res.status(404).json({ error: 'No such invite' });
      return;
    }

    await createMailer().send({
      to: invite.email,
      replyTo: environment.contactEmail,
      ...inviteEmail(invite.name, token),
    });
    await db(invitePath, {
      method: 'PATCH',
      body: JSON.stringify({ emailedAt: { '.sv': 'timestamp' } }),
    });
    res.json({ sent: true });
  } catch (error) {
    console.error('Error emailing speaker invite:', error);
    res.status(502).json({ error: 'Unable to send the invite email' });
  }
});

const PHOTO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
/** Speakers upload one photo at a time, so a small shared limit stops anyone filling the bucket. */
const photoLimit = { windowMs: 60_000, max: 20, recent: [] as number[] };

/**
 * Uploads an invited speaker's photo to devfest<year>/speakers/<key>/ in Storage, alongside the
 * photos admins upload, and returns its download URL for the page to save as the speaker's
 * imageUrl. Holding the invite token is the permission: the Storage rules only let admins upload,
 * so the server writes with its own service account (which needs write access to the bucket).
 * Locally, set FIREBASE_DATABASE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST to use the
 * emulators.
 */
app.post(
  '/api/speaker-edit/:token/photo',
  express.raw({ type: Object.keys(PHOTO_TYPES), limit: '5mb' }),
  async (req, res) => {
    try {
      const now = Date.now();
      photoLimit.recent = photoLimit.recent.filter((t) => now - t < photoLimit.windowMs);
      if (photoLimit.recent.length >= photoLimit.max) {
        res.set('Retry-After', String(Math.ceil(photoLimit.windowMs / 1000)));
        res.status(429).json({ error: 'Too many uploads, try again in a minute' });
        return;
      }
      photoLimit.recent.push(now);

      const token = req.params.token;
      const extension = PHOTO_TYPES[req.headers['content-type'] ?? ''];
      if (!INVITE_TOKEN.test(token)) {
        res.status(400).json({ error: 'Not an invite token' });
        return;
      }
      if (!extension || !Buffer.isBuffer(req.body) || !req.body.length) {
        res.status(400).json({ error: 'Upload a PNG, JPEG or WebP image under 5 MB' });
        return;
      }
      // Anyone may read a single invite by its token, so this needs no credentials.
      const invitePath = `devfest${environment.year}/speakerInvites/${token}.json`;
      const dbEmulator = process.env['FIREBASE_DATABASE_EMULATOR_HOST'];
      const namespace = new URL(environment.firebaseConfig.databaseURL).hostname.split('.')[0];
      const invite = await (
        await fetch(
          dbEmulator
            ? `http://${dbEmulator}/${invitePath}?ns=${namespace}`
            : `${environment.firebaseConfig.databaseURL}/${invitePath}`,
        )
      ).json();
      if (!invite?.speaker) {
        res.status(404).json({ error: 'No such invite' });
        return;
      }

      const emulator = process.env['FIREBASE_STORAGE_EMULATOR_HOST'];
      const access = emulator ? 'owner' : await googleAccessToken();
      if (!access) {
        res.status(503).json({ error: 'Photo uploads are not configured on this server' });
        return;
      }
      const bucket = environment.firebaseConfig.storageBucket;
      const name = `devfest${environment.year}/speakers/${invite.speaker}/photo-${now}.${extension}`;
      const downloadToken = randomUUID();
      const metadata = {
        name,
        contentType: req.headers['content-type'],
        cacheControl: 'max-age=604800',
        // What Firebase Storage download URLs are checked against.
        metadata: { firebaseStorageDownloadTokens: downloadToken },
      };
      const boundary = `photo-${randomUUID()}`;
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${metadata.contentType}\r\n\r\n`,
        ),
        req.body,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const host = emulator ? `http://${emulator}` : 'https://storage.googleapis.com';
      const upload = await fetch(
        `${host}/upload/storage/v1/b/${bucket}/o?uploadType=multipart&name=${encodeURIComponent(name)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${access}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      if (!upload.ok) {
        throw new Error(`Storage responded with ${upload.status}: ${await upload.text()}`);
      }
      const downloadHost = emulator
        ? `http://${emulator}`
        : 'https://firebasestorage.googleapis.com';
      res.json({
        imageUrl: `${downloadHost}/v0/b/${bucket}/o/${encodeURIComponent(name)}?alt=media&token=${downloadToken}`,
      });
    } catch (error) {
      console.error('Error uploading speaker photo:', error);
      res.status(502).json({ error: 'Unable to upload the photo' });
    }
  },
);

addVisitAnalytics(app);

/**
 * Serve static files from /browser. Build output with a content hash in its name (main-AB12cd34.js)
 * never changes, so it can be cached for a year. Everything else, like the images, sponsor logos and
 * sponsor packet under /a, keeps its name when it's replaced, so browsers check back after an hour.
 */
const hashedFile = /-[\w-]{8}\.(?:js|css)(?:\.map)?$/;
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'Cache-Control',
        hashedFile.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      );
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node.js version: ${process.version}`);
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
