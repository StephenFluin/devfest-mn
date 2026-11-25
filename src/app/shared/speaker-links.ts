import type { Speaker } from './data.service';

/** A link from a speaker's profile to somewhere else they can be found. */
export interface SpeakerLink {
  /** Which network or site, e.g. "Bluesky". */
  network: string;
  /** What to show, e.g. "Bluesky" or "@handle". */
  label: string;
  url: string;
}

/**
 * A Bluesky handle as stored, e.g. "you.bsky.social": people paste "@you.bsky.social" or their
 * profile's address just as often.
 */
export function blueskyHandle(typed: string | null | undefined): string | undefined {
  const handle = (typed ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?bsky\.app\/profile\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '');
  return handle || undefined;
}

/**
 * A Mastodon address as stored, e.g. "@you@mastodon.social", from that, "you@mastodon.social" or
 * a profile address like https://mastodon.social/@you. Anything else is kept as typed, and isn't
 * linked.
 */
export function mastodonAddress(typed: string | null | undefined): string | undefined {
  const text = (typed ?? '').trim();
  const fromUrl = /^https?:\/\/([^/\s]+)\/@([\w.-]+)\/?$/i.exec(text);
  if (fromUrl) return `@${fromUrl[2]}@${fromUrl[1].toLowerCase()}`;
  const address = /^@?([\w.-]+)@([a-z0-9-]+(\.[a-z0-9-]+)+)$/i.exec(text);
  if (address) return `@${address[1]}@${address[2].toLowerCase()}`;
  return text || undefined;
}

function blueskyUrl(stored: string | undefined) {
  const handle = blueskyHandle(stored);
  // A handle is a domain name; anything else (spaces, slashes) isn't one to link to.
  return handle && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(handle)
    ? `https://bsky.app/profile/${handle}`
    : undefined;
}

function mastodonUrl(stored: string | undefined) {
  const match = /^@([\w.-]+)@([a-z0-9.-]+)$/i.exec(mastodonAddress(stored) ?? '');
  return match ? `https://${match[2]}/@${match[1]}` : undefined;
}

/** A website or profile address someone typed, if it's a web address. */
function webUrl(stored: string | undefined) {
  const url = stored?.trim();
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

/** The speaker's links, for the ones they've supplied, in the order profiles show them. */
export function speakerLinks(speaker: Speaker | undefined): SpeakerLink[] {
  if (!speaker) return [];
  const twitter = speaker.twitter?.trim().replace(/^@/, '');
  const candidates: (SpeakerLink | { url: undefined })[] = [
    { network: 'X', label: `@${twitter}`, url: twitter ? `https://x.com/${twitter}` : undefined },
    { network: 'LinkedIn', label: 'LinkedIn', url: webUrl(speaker.linkedin) },
    { network: 'Bluesky', label: 'Bluesky', url: blueskyUrl(speaker.bluesky) },
    { network: 'Mastodon', label: 'Mastodon', url: mastodonUrl(speaker.mastodon) },
    { network: 'Website', label: 'Website', url: webUrl(speaker.website) },
  ];
  return candidates.filter((link): link is SpeakerLink => !!link.url);
}
