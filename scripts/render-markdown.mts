// Renders every speaker bio and session description to HTML (renderedBio, renderedDescription),
// for text saved before the site rendered Markdown on save. Only the rendered fields are written;
// the Markdown people wrote is left as it is. Safe to run again: unchanged HTML isn't rewritten.
//
// Usage (uses your Firebase CLI login, `npx firebase login`):
//   node scripts/render-markdown.mts [--year 2026] [--project devfestmn-2026] [--apply]
//
// Without --apply it prints what would change and writes nothing.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderMarkdown } from '../src/app/shared/markdown.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const year = option('--year', '2026');
const project = option('--project', `devfestmn-${year}`);
const apply = args.includes('--apply');

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
const speakers: Record<string, { name?: string; bio?: string; renderedBio?: string }> = read(
  `${base}/speakers`,
);
const schedule: Record<
  string,
  { title?: string; description?: string; renderedDescription?: string }
> = read(`${base}/schedule`);

/** Multi-path update relative to /devfest<year>; null deletes. */
const updates: Record<string, unknown> = {};

for (const [key, speaker] of Object.entries(speakers)) {
  const html = await renderMarkdown(speaker.bio);
  if (html !== (speaker.renderedBio ?? null)) {
    updates[`speakers/${key}/renderedBio`] = html;
  }
}
for (const [key, session] of Object.entries(schedule)) {
  const html = await renderMarkdown(session.description);
  if (html !== (session.renderedDescription ?? null)) {
    updates[`schedule/${key}/renderedDescription`] = html;
  }
}

for (const path of Object.keys(updates)) {
  const [list, key] = path.split('/');
  const item = list === 'speakers' ? speakers[key].name : schedule[key].title;
  console.log(`${base}/${path} (${item ?? 'untitled'})`);
}
if (!Object.keys(updates).length) {
  console.log('Nothing to change.');
} else if (!apply) {
  console.log(`\n${Object.keys(updates).length} changes. Run again with --apply to write them.`);
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'render-markdown-')), 'updates.json');
  writeFileSync(file, JSON.stringify(updates));
  firebase('database:update', base, file, '--force');
  console.log(`\nWrote ${Object.keys(updates).length} changes.`);
}
