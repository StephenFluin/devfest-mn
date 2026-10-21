/**
 * One visit to the site, as stored in analytics/<year>/sessions/<id> for the admin UTM funnel.
 * Visits are anonymous: there's no IP address, user agent, or visitor ID that links visits together.
 * The browser sends these fields to /api/visit and the server writes them; browsers can't write
 * to the database directly.
 */
export interface VisitSession {
  /** Server time the visit started, in ms. */
  start: number;
  /** Day the visit started, YYYY-MM-DD in Central time. */
  day: string;
  /** Last-touch campaign from the past 30 days, the same attribution Eventbrite checkout gets. */
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Hostname of the site that linked here, when it wasn't devfest.mn itself. */
  referrer?: string;
  /** Path of the first page viewed. */
  landing?: string;
  pages: number;
  /** At least 10 seconds on the page, a second page view, a ticket purchase, or a CFP click. */
  engaged?: boolean;
  /** Eventbrite order IDs completed during the visit. */
  orders?: Record<string, true>;
  /** Clicked through to the external call for papers form. */
  cfp?: boolean;
}

export const SESSION_ID = /^[a-z0-9]{16,32}$/;
export const ORDER_ID = /^[0-9]{1,20}$/;
export const CAMPAIGN_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

/** What the browser sends to /api/visit. */
export type VisitEvent =
  | ({ type: 'visit'; sid: string; referrer?: string; landing?: string } & Partial<
      Record<(typeof CAMPAIGN_FIELDS)[number], string>
    >)
  | { type: 'page'; sid: string; pages: number }
  | { type: 'engaged'; sid: string }
  | { type: 'purchase'; sid: string; order: string }
  | { type: 'cfp'; sid: string };
