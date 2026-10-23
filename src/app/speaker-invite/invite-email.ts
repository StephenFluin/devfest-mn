import { environment } from '../../environments/environment';

/** Invite tokens are 24 random bytes, base64url encoded (see DataService.inviteSpeaker). */
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
        "Your profile will appear on the site once we've confirmed your talk.",
      '',
      'Thanks,',
      'The DevFestMN team',
    ].join('\n'),
  };
}

/** Asks the server to email an invite. Admins only; uses the signed-in admin's ID token. */
export async function sendInviteEmail(idToken: string | undefined, token: string) {
  const response = await fetch(`/api/admin/speaker-invites/${token}/email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? `Sending failed (${response.status})`);
  }
}
