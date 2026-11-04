import { environment } from '../../environments/environment';
import { speakerShareOptions } from '../shared/share';
import { SPEAKER_PROMO_PERCENT, slugify } from '../shared/slug';

/** Invite tokens are 24 random bytes, base64url encoded (see DataService.createSpeakerInvite). */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{32}$/;

export function inviteLink(token: string) {
  return `${environment.siteUrl}/speaker-edit/${token}/edit`;
}

/** The invite sent by the server when an admin invites a speaker. */
export function inviteEmail(name: string, token: string) {
  return {
    subject: `We're happy to have you speak at DevFestMN ${environment.year}!`,
    text: [
      `Hi ${name},`,
      '',
      `We're excited to have you at DevFestMN ${environment.year} on ${environment.eventDateDisplay}! ` +
        'Please fill in your speaker profile (bio, company, photo, and links) here:',
      '',
      inviteLink(token),
      '',
      "Anyone with this link can edit your profile, so please don't share it. " +
        'Your profile will appear on the site once we publish your session.',
      '',
      'Thanks,',
      'The DevFestMN team',
    ].join('\n'),
  };
}

/**
 * The share kit sent to a published speaker: their short link and a post for each network, so
 * telling their followers about the session is a copy and paste.
 */
export function speakerKitEmail(name: string, sessions: string[], promoCode?: string) {
  const slug = slugify(name);
  const posts = speakerShareOptions(slug, sessions, promoCode);
  return {
    subject: `You're announced! Share your DevFestMN ${environment.year} session`,
    text: [
      `Hi ${name},`,
      '',
      `Your speaker page is live: ${speakerPageUrl(slug)}`,
      '',
      ...(promoCode
        ? [
            `Your audience gets ${SPEAKER_PROMO_PERCENT}% off tickets with your code, ${promoCode}. ` +
              'Your personal link applies it automatically.',
            '',
          ]
        : []),
      'Your followers and colleagues are exactly who DevFestMN is for, and a post from you reaches ' +
        "people we can't. Here's a ready-made post for each network (edit away), each with your " +
        'personal link so we can see how many people you bring:',
      '',
      ...posts
        .filter((post) => post.network !== 'email')
        .flatMap((post) => [`${post.label}:`, post.text, '']),
      `Your share card (the image that appears when your link is posted) is attached to your link automatically.`,
      '',
      'Thank you for speaking!',
      'The DevFestMN team',
    ].join('\n'),
  };
}

/** The speaker's short link, which redirects to their page tagged for the UTM funnel. */
export const speakerPageUrl = (nameSlug: string) => `${environment.siteUrl}/s/${nameSlug}`;

/** Asks the server to create a speaker's promo code, if they don't have one. Admins only. */
export async function createSpeakerPromoCode(idToken: string | undefined, speakerKey: string) {
  await postAsAdmin(`/api/admin/speakers/${speakerKey}/promo-code`, idToken);
}

/** Asks the server to email an invite. Admins only; uses the signed-in admin's ID token. */
export async function sendInviteEmail(idToken: string | undefined, token: string) {
  await postAsAdmin(`/api/admin/speaker-invites/${token}/email`, idToken);
}

/** Asks the server to email a published speaker their share kit. Admins only. */
export async function sendSpeakerKit(idToken: string | undefined, token: string) {
  await postAsAdmin(`/api/admin/speaker-invites/${token}/kit`, idToken);
}

async function postAsAdmin(url: string, idToken: string | undefined) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? `Sending failed (${response.status})`);
  }
}
