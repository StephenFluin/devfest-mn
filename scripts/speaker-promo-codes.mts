// Gives every speaker without a promo code the one they'd get if created today (see the
// /api/admin/speakers/:key/promo-code route), for speakers from before codes existed.
//
// Usage (uses your Firebase CLI login, `npx firebase login`, and EVENTBRITE_TOKEN from .env):
//   node scripts/speaker-promo-codes.mts [--limit 1] [--apply]
//
// Without --apply it prints the changes and writes nothing. It can be run again safely.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SPEAKER_PROMO_PERCENT, speakerPromoCode } from '../src/app/shared/slug.ts';
import { environment } from '../src/environments/environment.ts';

const args = process.argv.slice(2);
const limitAt = args.indexOf('--limit');
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const apply = args.includes('--apply');

process.loadEnvFile();
const token = process.env['EVENTBRITE_TOKEN'];
const eventId = environment.eventbriteEventId;
const project = `devfestmn-${environment.year}`;

async function eventbrite<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.eventbriteapi.com/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Eventbrite responded with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

const firebase = (...command: string[]) =>
  execFileSync(
    'npx',
    ['firebase', ...command, '--project', project, '--instance', `${project}-default-rtdb`],
    { encoding: 'utf8' },
  );

const base = `/devfest${environment.year}/speakers`;
const speakers: Record<string, { name?: string; promoCode?: string }> =
  JSON.parse(firebase('database:get', base).replace(/^i .*\n/gm, '') || 'null') ?? {};

const { organizations } = await eventbrite<{ organizations: { id: string }[] }>(
  '/users/me/organizations/',
);
const discountsUrl = `/organizations/${organizations[0].id}/discounts/`;

const existing = new Set<string>();
let continuation = '';
do {
  const page = await eventbrite<{
    discounts?: { code?: string }[];
    pagination?: { continuation?: string; has_more_items?: boolean };
  }>(`${discountsUrl}?scope=event&event_id=${eventId}${continuation}`);
  for (const discount of page.discounts ?? []) {
    if (discount.code) existing.add(discount.code);
  }
  continuation = page.pagination?.has_more_items
    ? `&continuation=${page.pagination.continuation}`
    : '';
} while (continuation);

const missing = Object.entries(speakers)
  .filter(([, speaker]) => speaker.name && !speaker.promoCode)
  .slice(0, limit);

/** Multi-path update relative to the speakers. */
const updates: Record<string, string> = {};
for (const [key, speaker] of missing) {
  const code = speakerPromoCode(speaker.name);
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(code)) {
    console.error(`Skipping ${speaker.name}: can't make a promo code from the name`);
    continue;
  }
  console.log(`${speaker.name}: ${code}${existing.has(code) ? ' (already in Eventbrite)' : ''}`);
  if (apply && !existing.has(code)) {
    await eventbrite(discountsUrl, {
      method: 'POST',
      body: JSON.stringify({
        discount: {
          type: 'coded',
          code,
          percent_off: SPEAKER_PROMO_PERCENT.toFixed(2),
          event_id: eventId,
        },
      }),
    });
    existing.add(code);
  }
  updates[`${key}/promoCode`] = code;
}

if (!Object.keys(updates).length) {
  console.log('Nothing to change.');
} else if (!apply) {
  console.log(`\n${Object.keys(updates).length} codes. Run again with --apply to create them.`);
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'speaker-promo-codes-')), 'updates.json');
  writeFileSync(file, JSON.stringify(updates));
  firebase('database:update', base, file, '--force');
  console.log(`\nCreated and saved ${Object.keys(updates).length} codes.`);
}
