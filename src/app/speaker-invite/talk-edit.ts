import type { Session } from '../shared/data.service';
import type { UntypedJson } from '../shared/untyped-json';

/**
 * What an invited speaker may change on their own talks. The time, room, length, track, notes and
 * who's presenting stay with the organizers, so the server only ever writes these fields.
 */
export const TALK_LIMITS = { title: 150, description: 5000 } as const;

/** Database keys of sessions, as pushed by the admin. */
export const SESSION_KEY = /^[A-Za-z0-9_-]{1,64}$/;

/** Whether the speaker is one of the session's presenters (its speakers map is id -> speaker key). */
export function presents(session: Session | null | undefined, speakerKey: string): boolean {
  return Object.values(session?.speakers ?? {}).includes(speakerKey);
}

/**
 * The fields to write for a speaker's edit of their talk, or an error to show them. Anything other
 * than the title and description is ignored.
 */
export function talkUpdate(
  body: UntypedJson,
): { update: Pick<Session, 'title' | 'description'> } | { error: string } {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  if (!title) {
    return { error: 'Your talk needs a title' };
  }
  if (title.length > TALK_LIMITS.title) {
    return { error: `Please keep the title under ${TALK_LIMITS.title} characters` };
  }
  if (description.length > TALK_LIMITS.description) {
    return { error: `Please keep the description under ${TALK_LIMITS.description} characters` };
  }
  // null clears the field in the database.
  return { update: { title, description: description || null } };
}

/**
 * The title of the talk created for a newly invited speaker, until they write their own. Also used
 * by scripts/publish-flag.mts.
 */
export function placeholderTalkTitle(name: string) {
  return `${name.trim()}'s talk`;
}
