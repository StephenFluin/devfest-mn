import { VisitSession } from '../shared/visit-session';

export type Dimension = 'source' | 'medium' | 'campaign';

export interface FunnelRow {
  /** One value per grouped dimension, in the order asked for. */
  keys: string[];
  visits: number;
  engaged: number;
  /** Visits that ended in at least one ticket order. */
  sales: number;
  /** Visits that clicked through to the call for papers form. */
  cfp: number;
}

/**
 * Like Google Analytics: a visit without UTM tags is credited to the site that linked to it
 * (medium "referral"), or to "(direct)" when nothing did.
 */
export function dimensionValue(session: Partial<VisitSession>, dimension: Dimension) {
  switch (dimension) {
    case 'source':
      return session.utm_source ?? session.referrer ?? '(direct)';
    case 'medium':
      return (
        session.utm_medium ??
        (session.utm_source ? '(not set)' : session.referrer ? 'referral' : '(none)')
      );
    case 'campaign':
      return session.utm_campaign ?? '(none)';
  }
}

/** Funnel counts per group, most visits first, for visits on or after `sinceDay` (YYYY-MM-DD). */
export function funnelRows(
  sessions: Partial<VisitSession>[],
  dimensions: Dimension[],
  sinceDay?: string,
): FunnelRow[] {
  const rows = new Map<string, FunnelRow>();
  for (const session of sessions) {
    if (sinceDay && !(session.day && session.day >= sinceDay)) continue;
    const keys = dimensions.map((dimension) => dimensionValue(session, dimension));
    const id = JSON.stringify(keys);
    const row = rows.get(id) ?? { keys, visits: 0, engaged: 0, sales: 0, cfp: 0 };
    row.visits++;
    if (session.engaged) row.engaged++;
    if (session.orders && Object.keys(session.orders).length) row.sales++;
    if (session.cfp) row.cfp++;
    rows.set(id, row);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.visits - a.visits || b.sales - a.sales || a.keys.join().localeCompare(b.keys.join()),
  );
}

export function totalRow(rows: FunnelRow[]): FunnelRow {
  return rows.reduce(
    (total, row) => ({
      keys: [],
      visits: total.visits + row.visits,
      engaged: total.engaged + row.engaged,
      sales: total.sales + row.sales,
      cfp: total.cfp + row.cfp,
    }),
    { keys: [], visits: 0, engaged: 0, sales: 0, cfp: 0 },
  );
}
