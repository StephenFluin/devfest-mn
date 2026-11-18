/**
 * The edit log: one entry per change to a speaker or session, stored at editLog/<id>, so
 * organizers can see who changed what and when (/admin/edit-log, and the History card in the
 * speaker and session editors).
 *
 * The browser that makes a change writes its entry right after the change is saved
 * (DataService.recordEdit). The database rules only accept an entry stamped with the writer's own
 * uid, the server's time and, for admins, their own email, and entries can't be changed or removed
 * afterwards. So an entry can be trusted about who wrote it, but a change made some other way (a
 * script, the Firebase console) isn't logged at all.
 */
export interface EditLogEntry {
  $key?: string;
  /** Server time (ms) the change was logged. */
  at: number;
  /** Which list the item is in. */
  path: EditLogPath;
  /** The speaker's or session's key. */
  key: string;
  /** Its name or title at the time, so the entry still reads well once the item is deleted. */
  label?: string;
  action: 'create' | 'update' | 'delete';
  /** Made by a signed-in admin, or by someone holding a speaker's private edit link. */
  via: 'admin' | 'invite';
  /** Firebase uid of the browser that made the change; anonymous for most speakers. */
  uid: string;
  /** The Google account, when the person was signed in with one. Always set for admins. */
  email?: string;
  name?: string;
  /** For `invite`: the speaker whose edit link was used. */
  speaker?: string;
  /** Each changed field's value before and after. A missing side means the field was empty. */
  changes?: Record<string, EditLogChange>;
}

export type EditLogPath = 'speakers' | 'schedule';
export type EditLogValue = string | number | boolean | string[];
export interface EditLogChange {
  from?: EditLogValue;
  to?: EditLogValue;
}

/** Derived or bookkeeping fields, which change on every save without anyone editing them. */
const NOT_LOGGED = new Set([
  '$key',
  'updatedAt',
  'renderedBio',
  'renderedDescription',
  'adminNotes',
]);

/** Longest text kept per side of a change; the rules refuse entries much longer than this. */
const MAX_TEXT = 6000;

/**
 * What a save changes, field by field: `after` holds the fields being written and `before` the
 * item as it was (undefined for a new one). Pass no `after` for a delete, which lists everything
 * the item had. Undefined when nothing a person would call a change is left.
 */
export function editChanges(
  before: object | null | undefined,
  after?: object | null,
): Record<string, EditLogChange> | undefined {
  const changes: Record<string, EditLogChange> = {};
  for (const field of Object.keys(after ?? before ?? {})) {
    if (NOT_LOGGED.has(field)) continue;
    const from = logged(before?.[field]);
    const to = after ? logged(after[field]) : undefined;
    if (same(from, to)) continue;
    changes[field] = { ...(from !== undefined && { from }), ...(to !== undefined && { to }) };
  }
  return Object.keys(changes).length ? changes : undefined;
}

/**
 * The entry for a change, apart from its time, which the server sets as it's saved. Undefined when
 * the change can't be attributed: someone who isn't an admin, with no speaker's edit link.
 *
 * @param user Whoever is signed in, anonymously or not.
 * @param speaker For a change to a session from a speaker's edit link: the speaker whose link it
 *   is. A change to their own profile needs no hint.
 */
export function editLogEntry(
  change: Pick<EditLogEntry, 'path' | 'key' | 'label' | 'action' | 'changes'>,
  user: { uid: string; email?: string | null; displayName?: string | null },
  admin: boolean,
  speaker?: string,
): Omit<EditLogEntry, 'at'> | undefined {
  // Anyone but an admin can only have made the change with a speaker's edit link.
  const linkOf = admin
    ? undefined
    : (speaker ?? (change.path === 'speakers' ? change.key : undefined));
  if (!admin && !linkOf) return undefined;
  const entry: Omit<EditLogEntry, 'at'> = {
    ...change,
    label: change.label?.trim().slice(0, 200),
    via: admin ? 'admin' : 'invite',
    uid: user.uid,
    email: user.email,
    name: user.displayName?.slice(0, 100),
    speaker: linkOf,
  };
  // Firebase rejects undefined, and an empty value says nothing.
  for (const [field, value] of Object.entries(entry)) {
    if (value === undefined || value === null || value === '') delete entry[field];
  }
  return entry;
}

/** A field's value as the log keeps it; undefined for an empty field. */
function logged(value: unknown): EditLogValue | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'string') {
    return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'object') {
    // A session's speakers map (id -> speaker key): who is on it matters, not the ids.
    const items = Object.values(value)
      .filter((item) => typeof item === 'string')
      .sort();
    return items.length ? items : undefined;
  }
  return undefined;
}

/** Unchecked and never set are the same to a person, as are 2 and "2" (older saved lengths). */
function same(a: EditLogValue | undefined, b: EditLogValue | undefined) {
  const plain = (value: EditLogValue | undefined) =>
    value === undefined || value === false ? '' : Array.isArray(value) ? value : String(value);
  return JSON.stringify(plain(a)) === JSON.stringify(plain(b));
}

/** Field names as the editors label them. */
export const EDIT_LOG_FIELDS: Record<string, string> = {
  name: 'Name',
  bio: 'Bio',
  company: 'Company',
  twitter: 'Twitter',
  imageUrl: 'Photo',
  website: 'Website',
  linkedin: 'LinkedIn',
  promoCode: 'Promo code',
  published: 'Published',
  title: 'Title',
  description: 'Description',
  speakers: 'Speakers',
  startTime: 'Start time',
  room: 'Room',
  track: 'Track',
  blocks: 'Length',
  notes: 'Last-minute note',
};
