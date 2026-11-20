import { describe, expect, it } from 'vitest';
import { isSponsorLogo, isSponsorWebsite, Sponsor, sponsorGroups } from './sponsor';

function sponsor($key: string, level: string, order: number, visible = true): Sponsor {
  return {
    $key,
    name: $key,
    level,
    logo: '/a/images/sponsors/google.svg',
    url: 'https://example.com',
    order,
    visible,
  };
}

describe('sponsors', () => {
  it('groups visible logos by level in display order and omits hidden-only levels', () => {
    const google = sponsor('google', 'Premiere', 0);
    const livefront = sponsor('livefront', 'Premiere', 1);
    const impactpharm = sponsor('impactpharm', 'Community', 2);
    const hidden = sponsor('hidden', 'Partner', 3, false);

    expect(sponsorGroups([impactpharm, hidden, livefront, google])).toEqual([
      { level: 'Premiere', sponsors: [google, livefront] },
      { level: 'Community', sponsors: [impactpharm] },
    ]);
    expect(sponsorGroups([hidden])).toEqual([]);
  });

  it('accepts web destinations and web or site asset logos', () => {
    expect(isSponsorWebsite('http://example.com/')).toBe(true);
    expect(isSponsorWebsite('https://example.com/?source=devfest')).toBe(true);
    expect(isSponsorLogo('https://example.com/logo.png')).toBe(true);
    expect(isSponsorLogo('/a/images/sponsors/google.svg')).toBe(true);
    expect(isSponsorWebsite('/a/images/sponsors/google.svg')).toBe(false);
  });

  it.each(['javascript:alert(1)', 'data:image/png;base64,00', '//example.com/logo', 'https://'])(
    'rejects an invalid logo or destination URL (%s)',
    (url) => {
      expect(isSponsorLogo(url)).toBe(false);
      expect(isSponsorWebsite(url)).toBe(false);
    },
  );
});
