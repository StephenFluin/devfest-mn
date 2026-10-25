import { environment } from '../../environments/environment';
import { VisitSession } from './visit-session';

/**
 * A marketing campaign: one place DevFestMN is promoted (a meetup listing, a poster, a partner's
 * newsletter, an ad), with its own short link https://devfest.mn/go/<slug>. The link tags visits
 * with UTM parameters for the admin UTM funnel and an Eventbrite affiliate code (the slug), so
 * ticket orders can be credited back to the campaign from Eventbrite's own records.
 *
 * Campaigns are stored in two halves under marketing/<year>: `links/<slug>` is public, because the
 * server reads it to redirect, and holds only what the redirect needs; `campaigns/<slug>` is
 * admin-only and holds the rest (name, spend, notes, the Eventbrite discount id).
 */
export interface CampaignLink {
  /** utm_source, e.g. "meetup". */
  source: string;
  /** utm_medium, e.g. "listing". */
  medium: string;
  /** utm_campaign; defaults to the slug. */
  campaign: string;
  /** Site path the link opens, e.g. "/" or "/speakers". */
  landing: string;
  /** Eventbrite promo code the checkout pre-applies, when the campaign has one. */
  promo?: string;
}

export interface Campaign {
  $key?: string;
  name: string;
  /** Which preset the campaign was created from, for the table. */
  preset?: string;
  notes?: string;
  /** Money spent on this campaign so far, in USD. */
  spend?: number;
  /** Percent off for the promo code, when one was created. */
  percentOff?: number;
  /** How many tickets the promo code may be used for; unset means unlimited. */
  promoQuantity?: number;
  /** Eventbrite's id for the discount, once it has been created there. */
  discountId?: string;
  createdAt?: number;
  createdBy?: string;
}

/** An anonymous Eventbrite order as copied into burndown/<year>/orders. */
export interface BurndownOrder {
  day: string;
  time?: string;
  tickets: number;
  price: number;
  /** Eventbrite affiliate code the order was placed with, lowercased. */
  affiliate?: string;
}

/** Promo code usage as copied into burndown/<year>/discounts/<key>. */
export interface DiscountUsage {
  code: string;
  sold: number;
  available?: number;
}

export const CAMPAIGN_SLUG = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const PROMO_CODE = /^[A-Za-z0-9_-]{2,30}$/;

export const campaignUrl = (slug: string) => `${environment.siteUrl}/go/${slug}`;
export const campaignQrUrl = (slug: string) => `${environment.siteUrl}/go/${slug}.png`;

/**
 * Eventbrite affiliate code for a visit's attribution: the explicit `aff` if there is one (campaign
 * short links set it to the slug), otherwise built from utm_source and utm_campaign. Eventbrite
 * allows letters, digits, dashes and underscores.
 */
export function affiliateCode(attribution: Record<string, string | undefined>) {
  return (
    attribution['aff'] ??
    [attribution['utm_source'], attribution['utm_campaign']].filter(Boolean).join('-')
  )
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .slice(0, 50);
}

/** Where /go/<slug> sends people: the landing page with the campaign's tags. */
export function campaignRedirect(slug: string, link: CampaignLink) {
  const params = new URLSearchParams({
    utm_source: link.source,
    utm_medium: link.medium,
    utm_campaign: link.campaign || slug,
    aff: slug,
  });
  if (link.promo) params.set('promo', link.promo);
  const landing = link.landing?.startsWith('/') ? link.landing : '/';
  return `${landing}${landing.includes('?') ? '&' : '?'}${params}`;
}

/** Key for a promo code under burndown/<year>/discounts (Firebase keys can't hold ".#$[]/"). */
export const discountKey = (code: string) => code.toLowerCase().replace(/[.#$[\]/]/g, '_');

export interface CampaignStats {
  visits: number;
  engaged: number;
  /** Visits that completed an order on the site. */
  sales: number;
  /** Tickets Eventbrite credits to the campaign's affiliate code. */
  tickets: number;
  /** Ticket revenue for those orders, excluding fees and tax. */
  revenue: number;
  /** Times the promo code has been used, from Eventbrite. */
  promoUsed?: number;
  spend: number;
  /** Spend per ticket sold, or undefined with no spend or no tickets. */
  costPerTicket?: number;
}

/**
 * How a campaign is doing, joining the site's own visit analytics (by utm_source and utm_campaign)
 * with Eventbrite's orders (by affiliate code) and promo code usage.
 */
export function campaignStats(
  slug: string,
  link: CampaignLink,
  campaign: Partial<Campaign>,
  sessions: Partial<VisitSession>[],
  orders: BurndownOrder[],
  discounts: Record<string, DiscountUsage> = {},
): CampaignStats {
  const campaignName = link.campaign || slug;
  const stats: CampaignStats = {
    visits: 0,
    engaged: 0,
    sales: 0,
    tickets: 0,
    revenue: 0,
    spend: campaign.spend ?? 0,
  };
  for (const session of sessions) {
    if (session.utm_source !== link.source || session.utm_campaign !== campaignName) continue;
    stats.visits++;
    if (session.engaged) stats.engaged++;
    if (session.orders && Object.keys(session.orders).length) stats.sales++;
  }
  for (const order of orders) {
    if (order.affiliate !== slug) continue;
    stats.tickets += order.tickets ?? 0;
    stats.revenue += order.price ?? 0;
  }
  if (link.promo) {
    stats.promoUsed = discounts[discountKey(link.promo)]?.sold ?? 0;
  }
  if (stats.spend && stats.tickets) {
    stats.costPerTicket = stats.spend / stats.tickets;
  }
  return stats;
}

/**
 * Ready-made campaign shapes for the places a Twin Cities developer conference gets found. Each
 * prefills the form and says where to put the link.
 */
export interface CampaignPreset {
  id: string;
  label: string;
  source: string;
  medium: string;
  /** Where to post the link, shown under the form. */
  hint: string;
  /** Whether a promo code is the point of this kind of campaign. */
  promo?: boolean;
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: 'meetup',
    label: 'Meetup or GDG event listing',
    source: 'meetup',
    medium: 'listing',
    hint: 'Create the event on gdg.community.dev, Meetup and Luma with this as the ticket link, so people browsing for events find it.',
  },
  {
    id: 'community',
    label: 'Local meetup announcement',
    source: 'community',
    medium: 'referral',
    promo: true,
    hint: 'Ask organizers of other Twin Cities meetups to announce DevFestMN at their next event, with this link and code for their members.',
  },
  {
    id: 'partner',
    label: 'Partner or company discount',
    source: 'partner',
    medium: 'referral',
    promo: true,
    hint: 'Give a company, bootcamp or university a link and code of their own to send to their engineers or students.',
  },
  {
    id: 'sponsor',
    label: 'Sponsor amplification',
    source: 'sponsor',
    medium: 'partner',
    hint: "Send each sponsor a link to share in their newsletter and social posts; their audience is the event's audience.",
  },
  {
    id: 'newsletter',
    label: 'Newsletter mention',
    source: 'newsletter',
    medium: 'email',
    hint: 'For tech.mn, Minnestar, university CS departments and company newsletters. One campaign per newsletter.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn event or post',
    source: 'linkedin',
    medium: 'social',
    hint: 'Create a LinkedIn Event with this link, and ask speakers and sponsors to mark themselves attending.',
  },
  {
    id: 'social',
    label: 'Bluesky or Mastodon post',
    source: 'bluesky',
    medium: 'social',
    hint: 'Pin a post on the DevFestMN accounts with this link so the pinned post is measured separately from replies.',
  },
  {
    id: 'slack',
    label: 'Slack or Discord community',
    source: 'slack',
    medium: 'chat',
    hint: 'Post in local developer Slacks and Discords (one campaign each) so the funnel shows which communities convert.',
  },
  {
    id: 'poster',
    label: 'Poster or flyer with QR code',
    source: 'poster',
    medium: 'qr',
    hint: 'Print the QR code for coworking spaces, university buildings and meetup venues. Each location gets its own campaign.',
  },
  {
    id: 'google-ads',
    label: 'Google Ads',
    source: 'google',
    medium: 'cpc',
    hint: 'Use this as the final URL and record spend here, so cost per ticket shows next to the organic campaigns.',
  },
  {
    id: 'linkedin-ads',
    label: 'LinkedIn Ads',
    source: 'linkedin',
    medium: 'paid_social',
    hint: 'Target software engineers in the Minneapolis–St. Paul area. Record spend here to compare with other channels.',
  },
  {
    id: 'meta-ads',
    label: 'Meta or Reddit Ads',
    source: 'meta',
    medium: 'paid_social',
    hint: 'Change the source to "reddit" for Reddit. Record spend to see cost per ticket.',
  },
  {
    id: 'other',
    label: 'Something else',
    source: 'other',
    medium: 'referral',
    hint: 'Any other place the link goes. Pick a short, specific slug.',
  },
];
