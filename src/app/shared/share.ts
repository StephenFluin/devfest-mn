import { environment } from '../../environments/environment';

/**
 * Ready-to-post messages that attendees and speakers can share, each with a link tagged so the UTM
 * funnel shows which network the resulting visits and ticket sales came from.
 */
export type ShareNetwork = 'linkedin' | 'bluesky' | 'x' | 'email' | 'copy';

export interface ShareOption {
  network: ShareNetwork;
  label: string;
  /** What gets posted (or copied), including the link. */
  text: string;
  /** Opens the network's compose screen; absent for copy-to-clipboard. */
  href?: string;
}

const NETWORKS: { network: ShareNetwork; label: string }[] = [
  { network: 'linkedin', label: 'LinkedIn' },
  { network: 'bluesky', label: 'Bluesky' },
  { network: 'x', label: 'X' },
  { network: 'email', label: 'Email' },
  { network: 'copy', label: 'Copy for Slack or Mastodon' },
];

/** A site link tagged for the funnel: source, which network it was shared on, and the campaign. */
export function shareLink(path: string, source: string, network: string, campaign: string) {
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: network,
    utm_campaign: campaign,
  });
  return `${environment.siteUrl}${path}?${params}`;
}

/** The compose screen for a network, with the text (which includes the link) filled in. */
export function composeUrl(network: ShareNetwork, text: string, subject: string) {
  const encoded = encodeURIComponent(text);
  switch (network) {
    case 'linkedin':
      return `https://www.linkedin.com/feed/?shareActive=true&text=${encoded}`;
    case 'bluesky':
      return `https://bsky.app/intent/compose?text=${encoded}`;
    case 'x':
      return `https://x.com/intent/post?text=${encoded}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(subject)}&body=${encoded}`;
    case 'copy':
      return undefined;
  }
}

/**
 * One option per network. `message(link)` writes the post around the link for that network, so the
 * same words go out everywhere but each network's visits are counted separately.
 */
export function shareOptions(
  path: string,
  source: string,
  campaign: string,
  subject: string,
  message: (link: string) => string,
): ShareOption[] {
  return NETWORKS.map(({ network, label }) => {
    const text = message(shareLink(path, source, network === 'copy' ? 'chat' : network, campaign));
    return { network, label, text, href: composeUrl(network, text, subject) };
  });
}

const EVENT = `DevFestMN ${environment.year}, the Twin Cities developer conference on ${environment.eventDateDisplay}`;

/** What a new ticket holder can post. */
export function attendeeShareOptions() {
  return shareOptions(
    '/',
    'attendee',
    'attendee_share',
    `Join me at DevFestMN ${environment.year}`,
    (link) =>
      `I just got my ticket to ${EVENT} in Minneapolis. ` +
      `A day of talks on AI, cloud, mobile and the web. Join me! ${link} #DevFestMN`,
  );
}

/** What a published speaker can post about their talk. The link is their /s/ short link. */
export function speakerShareOptions(nameSlug: string, talks: string[]) {
  const about = talks.length ? ` about “${talks.join('” and “')}”` : '';
  return NETWORKS.map(({ network, label }) => {
    // The /s/ redirect sets utm_source=speaker and the speaker's campaign; `m` is the medium.
    const link = `${environment.siteUrl}/s/${nameSlug}?m=${network === 'copy' ? 'chat' : network}`;
    const text =
      `I'm speaking at ${EVENT} in Minneapolis${about}. ` +
      `Come say hi! Tickets and details: ${link} #DevFestMN`;
    return {
      network,
      label,
      text,
      href: composeUrl(network, text, `Come see my talk at DevFestMN ${environment.year}`),
    };
  });
}
