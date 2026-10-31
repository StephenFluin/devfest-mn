// Moves the year's data to the `published` flag, once per year's project:
//
//   --flags  Speakers: renames `confirmed` to `published`. Sessions: marks any without the flag as
//            published, since every session was public before the flag existed.
//   --talks  Gives every speaker who isn't on any session an unpublished "<Name>'s talk", like
//            inviting a speaker does now, so they can fill it in from their edit link. Run this
//            only once the code that understands `published` is live: older code shows every
//            session, including these.
//
// Usage (uses your Firebase CLI login, `npx firebase login`):
//   node scripts/publish-flag.mts --flags --talks [--year 2026] [--project devfestmn-2026] [--apply]
//
// Without --apply it prints the changes and writes nothing. Both steps can be run again safely.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { placeholderTalkTitle } from '../src/app/speaker-invite/talk-edit.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const year = option('--year', '2026');
const project = option('--project', `devfestmn-${year}`);
const apply = args.includes('--apply');
if (!args.includes('--flags') && !args.includes('--talks')) {
  console.error('Pass --flags, --talks or both. See the top of this file.');
  process.exit(1);
}

const firebase = (...command: string[]) =>
  execFileSync(
    'npx',
    ['firebase', ...command, '--project', project, '--instance', `${project}-default-rtdb`],
    { encoding: 'utf8' },
  );
// The CLI prints an "i  ...emulator" notice before the JSON when FIREBASE_DATABASE_EMULATOR_HOST is set.
const read = (path: string) =>
  JSON.parse(firebase('database:get', path).replace(/^i .*\n/gm, '') || 'null') ?? {};

const base = `/devfest${year}`;
const speakers: Record<string, { name?: string; confirmed?: boolean; published?: boolean }> = read(
  `${base}/speakers`,
);
const schedule: Record<string, { title?: string; published?: boolean; speakers?: object }> = read(
  `${base}/schedule`,
);

/** Multi-path update relative to /devfest<year>; null deletes. */
const updates: Record<string, unknown> = {};

if (args.includes('--flags')) {
  for (const [key, speaker] of Object.entries(speakers)) {
    if ('confirmed' in speaker) {
      updates[`speakers/${key}/published`] = speaker.published ?? speaker.confirmed === true;
      updates[`speakers/${key}/confirmed`] = null;
    }
  }
  for (const [key, session] of Object.entries(schedule)) {
    if (!('published' in session)) {
      updates[`schedule/${key}/published`] = true;
    }
  }
}

if (args.includes('--talks')) {
  const presenting = new Set(
    Object.values(schedule).flatMap((session) => Object.values(session.speakers ?? {})),
  );
  for (const [key, speaker] of Object.entries(speakers)) {
    if (presenting.has(key) || !speaker.name) continue;
    updates[`schedule/${pushId()}`] = {
      title: placeholderTalkTitle(speaker.name),
      published: false,
      speakers: { [pushId()]: key },
      updatedAt: { '.sv': 'timestamp' },
    };
  }
}

for (const [path, value] of Object.entries(updates)) {
  console.log(`${base}/${path} =`, JSON.stringify(value));
}
if (!Object.keys(updates).length) {
  console.log('Nothing to change.');
} else if (!apply) {
  console.log(`\n${Object.keys(updates).length} changes. Run again with --apply to write them.`);
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'publish-flag-')), 'updates.json');
  writeFileSync(file, JSON.stringify(updates));
  firebase('database:update', base, file, '--force');
  console.log(`\nWrote ${Object.keys(updates).length} changes.`);
}

/** A key in the style of the client SDK's push(): time-ordered, then random. */
function pushId() {
  const chars = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  let time = Date.now();
  let id = '';
  for (let i = 0; i < 8; i++) {
    id = chars[time % 64] + id;
    time = Math.floor(time / 64);
  }
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * 64)];
  }
  return id;
}
