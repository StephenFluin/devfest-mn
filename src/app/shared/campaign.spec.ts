import { environment } from '../../environments/environment';
import {
  affiliateCode,
  CAMPAIGN_PRESETS,
  CAMPAIGN_SLUG,
  campaignQrUrl,
  campaignRedirect,
  campaignStats,
  campaignUrl,
  CampaignLink,
  discountKey,
  PROMO_CODE,
} from './campaign';

const link: CampaignLink = {
  source: 'meetup',
  medium: 'listing',
  campaign: 'tc-js',
  landing: '/',
};

describe('campaign links', () => {
  it('are short links under /go/, with a QR code beside each', () => {
    expect(campaignUrl('tc-js')).toBe(`${environment.siteUrl}/go/tc-js`);
    expect(campaignQrUrl('tc-js')).toBe(`${environment.siteUrl}/go/tc-js.png`);
  });

  it('accept slugs that are safe in a URL and as a database key', () => {
    for (const slug of ['tc-js', 'a1', '2026-poster-umn']) {
      expect(CAMPAIGN_SLUG.test(slug)).toBe(true);
    }
    for (const slug of ['a', '-lead', 'Upper', 'has space', 'dot.com', 'a'.repeat(41)]) {
      expect(CAMPAIGN_SLUG.test(slug)).toBe(false);
    }
  });

  it('accept promo codes Eventbrite takes', () => {
    expect(PROMO_CODE.test('JANE-DOE')).toBe(true);
    expect(PROMO_CODE.test('gdg_20')).toBe(true);
    expect(PROMO_CODE.test('A')).toBe(false);
    expect(PROMO_CODE.test('20% OFF')).toBe(false);
    expect(PROMO_CODE.test('A'.repeat(31))).toBe(false);
  });
});

describe('campaignRedirect', () => {
  const params = (url: string) => Object.fromEntries(new URL(url, 'https://x.test').searchParams);

  it('tags the landing page with the campaign and its affiliate code', () => {
    const url = campaignRedirect('tc-js-nov', link);
    expect(url.startsWith('/?')).toBe(true);
    expect(params(url)).toEqual({
      utm_source: 'meetup',
      utm_medium: 'listing',
      utm_campaign: 'tc-js',
      aff: 'tc-js-nov',
    });
  });

  it('names the campaign after the slug when it has no name of its own', () => {
    expect(params(campaignRedirect('poster-umn', { ...link, campaign: '' }))['utm_campaign']).toBe(
      'poster-umn',
    );
  });

  it('pre-applies a promo code', () => {
    expect(params(campaignRedirect('tc-js', { ...link, promo: 'TCJS' }))['promo']).toBe('TCJS');
  });

  it('keeps a landing page and any query it already has', () => {
    const url = campaignRedirect('tc-js', { ...link, landing: '/speakers?filter=ai' });
    expect(url.startsWith('/speakers?filter=ai&utm_source=meetup')).toBe(true);
  });

  it('only ever lands on this site', () => {
    for (const landing of ['https://evil.example/', 'speakers', undefined]) {
      expect(campaignRedirect('tc-js', { ...link, landing }).startsWith('/?')).toBe(true);
    }
  });
});

describe('affiliateCode', () => {
  it("is the short link's own code when there is one", () => {
    expect(affiliateCode({ aff: 'TC-JS', utm_source: 'meetup', utm_campaign: 'other' })).toBe(
      'tc-js',
    );
  });

  it('is otherwise built from the source and campaign', () => {
    expect(affiliateCode({ utm_source: 'Speaker', utm_campaign: 'speaker_jane-doe' })).toBe(
      'speaker-speaker_jane-doe',
    );
    expect(affiliateCode({ utm_source: 'newsletter' })).toBe('newsletter');
    expect(affiliateCode({})).toBe('');
  });

  it('sticks to the characters and length Eventbrite allows', () => {
    expect(affiliateCode({ utm_source: 'tech.mn', utm_campaign: 'Fall News!' })).toBe(
      'tech_mn-fall_news_',
    );
    expect(affiliateCode({ aff: 'x'.repeat(80) })).toHaveLength(50);
  });
});

describe('discountKey', () => {
  it('makes a promo code usable as a database key', () => {
    expect(discountKey('JANE-DOE')).toBe('jane-doe');
    expect(discountKey('A.B#C$D[E]F/G')).toBe('a_b_c_d_e_f_g');
  });
});

describe('campaignStats', () => {
  const sessions = [
    { utm_source: 'meetup', utm_campaign: 'tc-js' },
    { utm_source: 'meetup', utm_campaign: 'tc-js', engaged: true },
    {
      utm_source: 'meetup',
      utm_campaign: 'tc-js',
      engaged: true,
      orders: { '123': true } as const,
    },
    { utm_source: 'meetup', utm_campaign: 'tc-js', orders: {} },
    // Same campaign name from another source, and the same source with another campaign.
    { utm_source: 'slack', utm_campaign: 'tc-js', engaged: true },
    { utm_source: 'meetup', utm_campaign: 'other', engaged: true },
    {},
  ];
  const orders = [
    { day: '2026-11-01', tickets: 2, price: 60, affiliate: 'tc-js-nov' },
    { day: '2026-11-02', tickets: 1, price: 30, affiliate: 'tc-js-nov' },
    { day: '2026-11-02', tickets: 5, price: 150, affiliate: 'someone-else' },
    { day: '2026-11-03', tickets: 1, price: 30 },
  ];

  it("joins the site's visits with Eventbrite's orders for the campaign", () => {
    expect(campaignStats('tc-js-nov', link, { spend: 45 }, sessions, orders)).toEqual({
      visits: 4,
      engaged: 2,
      sales: 1,
      tickets: 3,
      revenue: 90,
      spend: 45,
      costPerTicket: 15,
    });
  });

  it('leaves out cost per ticket with no spend or no tickets', () => {
    expect(campaignStats('tc-js-nov', link, {}, sessions, orders).costPerTicket).toBeUndefined();
    expect(campaignStats('unused', link, { spend: 45 }, sessions, orders).costPerTicket).toBe(
      undefined,
    );
  });

  it("counts uses of the campaign's promo code, whatever its case", () => {
    const withPromo = { ...link, promo: 'TCJS.20' };
    const discounts = { tcjs_20: { code: 'TCJS.20', sold: 7 } };
    expect(campaignStats('tc-js-nov', withPromo, {}, [], [], discounts).promoUsed).toBe(7);
    expect(campaignStats('tc-js-nov', withPromo, {}, [], []).promoUsed).toBe(0);
    expect(campaignStats('tc-js-nov', link, {}, [], [], discounts).promoUsed).toBeUndefined();
  });
});

describe('CAMPAIGN_PRESETS', () => {
  it('have distinct ids, since the form picks a preset by id', () => {
    const ids = CAMPAIGN_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
