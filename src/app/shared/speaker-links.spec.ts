import { blueskyHandle, mastodonAddress, speakerLinks } from './speaker-links';

describe('blueskyHandle', () => {
  it('takes a handle with or without the @', () => {
    expect(blueskyHandle('you.bsky.social')).toBe('you.bsky.social');
    expect(blueskyHandle(' @you.bsky.social ')).toBe('you.bsky.social');
  });

  it('takes a profile address', () => {
    expect(blueskyHandle('https://bsky.app/profile/you.example.com/')).toBe('you.example.com');
  });

  it('is empty for nothing', () => {
    expect(blueskyHandle('  ')).toBeUndefined();
    expect(blueskyHandle(undefined)).toBeUndefined();
  });
});

describe('mastodonAddress', () => {
  it('takes an address with or without the leading @', () => {
    expect(mastodonAddress('@you@mastodon.social')).toBe('@you@mastodon.social');
    expect(mastodonAddress('you@Hachyderm.io')).toBe('@you@hachyderm.io');
  });

  it('takes a profile address', () => {
    expect(mastodonAddress('https://fosstodon.org/@you')).toBe('@you@fosstodon.org');
  });

  it('keeps anything else as typed', () => {
    expect(mastodonAddress('just-a-name')).toBe('just-a-name');
    expect(mastodonAddress('')).toBeUndefined();
  });
});

describe('speakerLinks', () => {
  it('is empty for a speaker with no links', () => {
    expect(speakerLinks({ name: 'Ada' })).toEqual([]);
    expect(speakerLinks(undefined)).toEqual([]);
  });

  it('lists only the links supplied, in profile order', () => {
    const links = speakerLinks({
      website: 'https://example.com',
      mastodon: '@ada@mastodon.social',
      bluesky: 'ada.bsky.social',
      linkedin: 'https://www.linkedin.com/in/ada',
      twitter: 'ada',
    });
    expect(links.map((link) => link.network)).toEqual([
      'X',
      'LinkedIn',
      'Bluesky',
      'Mastodon',
      'Website',
    ]);
    expect(links.map((link) => link.url)).toEqual([
      'https://x.com/ada',
      'https://www.linkedin.com/in/ada',
      'https://bsky.app/profile/ada.bsky.social',
      'https://mastodon.social/@ada',
      'https://example.com',
    ]);
    expect(links[0].label).toBe('@ada');
  });

  it("leaves out what isn't a usable address", () => {
    expect(
      speakerLinks({
        website: 'javascript:alert(1)',
        linkedin: 'ada',
        bluesky: 'not a handle',
        mastodon: 'ada',
      }),
    ).toEqual([]);
  });
});
