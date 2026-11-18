import { dimensionValue, funnelRows, totalRow } from './utm-funnel';

describe('dimensionValue', () => {
  it('uses the UTM tags when a visit has them', () => {
    const tagged = { utm_source: 'meetup', utm_medium: 'listing', utm_campaign: 'tc-js' };
    expect(dimensionValue(tagged, 'source')).toBe('meetup');
    expect(dimensionValue(tagged, 'medium')).toBe('listing');
    expect(dimensionValue(tagged, 'campaign')).toBe('tc-js');
  });

  it('credits an untagged visit to the site that linked to it', () => {
    const referred = { referrer: 'news.ycombinator.com' };
    expect(dimensionValue(referred, 'source')).toBe('news.ycombinator.com');
    expect(dimensionValue(referred, 'medium')).toBe('referral');
    expect(dimensionValue(referred, 'campaign')).toBe('(none)');
  });

  it('calls a visit with neither direct', () => {
    expect(dimensionValue({}, 'source')).toBe('(direct)');
    expect(dimensionValue({}, 'medium')).toBe('(none)');
  });

  it('prefers the tags to the referrer, and says when a tagged visit has no medium', () => {
    const visit = { utm_source: 'newsletter', referrer: 'mail.google.com' };
    expect(dimensionValue(visit, 'source')).toBe('newsletter');
    expect(dimensionValue(visit, 'medium')).toBe('(not set)');
  });
});

describe('funnelRows', () => {
  const sessions = [
    { day: '2026-11-01', utm_source: 'meetup', utm_medium: 'listing' },
    { day: '2026-11-02', utm_source: 'meetup', utm_medium: 'listing', engaged: true },
    {
      day: '2026-11-03',
      utm_source: 'meetup',
      utm_medium: 'listing',
      engaged: true,
      orders: { '1': true } as const,
    },
    { day: '2026-11-03', utm_source: 'meetup', utm_medium: 'social', cfp: true, engaged: true },
    { day: '2026-11-02', referrer: 'bsky.app', orders: {} },
    { day: '2026-11-04' },
  ];

  it('counts visits, engagement, sales and CFP clicks per group', () => {
    expect(funnelRows(sessions, ['source'])).toEqual([
      { keys: ['meetup'], visits: 4, engaged: 3, sales: 1, cfp: 1 },
      { keys: ['(direct)'], visits: 1, engaged: 0, sales: 0, cfp: 0 },
      { keys: ['bsky.app'], visits: 1, engaged: 0, sales: 0, cfp: 0 },
    ]);
  });

  it('groups by every dimension asked for, in order', () => {
    expect(funnelRows(sessions, ['source', 'medium']).map((row) => row.keys)).toEqual([
      ['meetup', 'listing'],
      ['(direct)', '(none)'],
      ['bsky.app', 'referral'],
      ['meetup', 'social'],
    ]);
  });

  it('puts the group with more sales first when visits tie', () => {
    const tied = [
      { utm_source: 'a' },
      { utm_source: 'b', orders: { '1': true } as const },
      { utm_source: 'c' },
    ];
    expect(funnelRows(tied, ['source']).map((row) => row.keys[0])).toEqual(['b', 'a', 'c']);
  });

  it('keeps only visits on or after a day, dropping any with no day', () => {
    const recent = funnelRows([...sessions, { utm_source: 'undated' }], ['source'], '2026-11-03');
    expect(recent).toEqual([
      { keys: ['meetup'], visits: 2, engaged: 2, sales: 1, cfp: 1 },
      { keys: ['(direct)'], visits: 1, engaged: 0, sales: 0, cfp: 0 },
    ]);
  });

  it('is one row for everything with no dimensions', () => {
    expect(funnelRows(sessions, [])).toEqual([
      { keys: [], visits: 6, engaged: 3, sales: 1, cfp: 1 },
    ]);
  });
});

describe('totalRow', () => {
  it('adds the rows up', () => {
    expect(
      totalRow([
        { keys: ['a'], visits: 4, engaged: 3, sales: 1, cfp: 1 },
        { keys: ['b'], visits: 2, engaged: 1, sales: 1, cfp: 0 },
      ]),
    ).toEqual({ keys: [], visits: 6, engaged: 4, sales: 2, cfp: 1 });
  });

  it('is all zeros for no rows', () => {
    expect(totalRow([])).toEqual({ keys: [], visits: 0, engaged: 0, sales: 0, cfp: 0 });
  });
});
