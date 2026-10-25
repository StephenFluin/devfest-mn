import { signal } from '@angular/core';
import { environment } from '../environments/environment';
import { affiliateCode } from './shared/campaign';
import { trackVisitCfp, trackVisitPurchase } from './visit-tracker';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    EBWidgets: { createWidget(options: Record<string, unknown>): void };
  }
}

/** The Eventbrite order just completed in this page, so the app can thank and prompt the buyer. */
export const completedOrder = signal<string | null>(null);

export const trackTicketPurchase = function (orderData: { orderId: string }) {
  trackVisitPurchase(orderData.orderId);
  completedOrder.set(String(orderData.orderId));
  const value = { value: 50.0, currency: 'USD', transaction_id: orderData.orderId };
  window.gtag('event', 'purchase', { ...value, event_label: 'Ticket Sale' });
  // Google Ads only learns which clicks sold tickets if the purchase is reported as a conversion.
  if (environment.adConversions.googleAds) {
    window.gtag('event', 'conversion', { ...value, send_to: environment.adConversions.googleAds });
  }
};

/** A click through to the external call for papers form. */
export function trackCfpClick() {
  trackVisitCfp();
  window.gtag?.('event', 'cfp_click', { event_label: 'Call for Papers' });
}

const ATTRIBUTION_KEY = 'attribution';
const ATTRIBUTION_DAYS = 30;
const ATTRIBUTION_PARAMS = [
  'aff',
  'promo',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
];

type Attribution = Record<string, string>;

/**
 * Remembers the campaign a visitor arrived from (last touch, for 30 days) so a ticket bought
 * later in the visit, or on a return visit, is still credited to it in Eventbrite.
 */
export function captureAttribution() {
  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  for (const name of ATTRIBUTION_PARAMS) {
    const value = params.get(name)?.trim();
    if (value) {
      found[name] = value.slice(0, 100);
    }
  }
  if (!Object.keys(found).length) {
    return;
  }
  try {
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ ...found, savedAt: Date.now() }));
  } catch {
    // Storage is unavailable (private mode or blocked); carry on without it.
  }
}

export function storedAttribution(): Attribution {
  try {
    const { savedAt, ...stored } = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) ?? '{}');
    if (Date.now() - savedAt < ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000) {
      return stored;
    }
  } catch {
    // Storage is unavailable (private mode or blocked); carry on without it.
  }
  return {};
}

/**
 * Options for EBWidgets.createWidget that carry the visitor's campaign into checkout. Eventbrite
 * reports orders by affiliate code (its `aff` tracking-link parameter), so an explicit `aff` wins
 * (campaign short links set it to the campaign's slug), otherwise the code is built from utm_source
 * and utm_campaign, e.g. "linkedin-cfp_push". A campaign's promo code is pre-applied in checkout.
 * The raw UTM parameters ride along too in case Eventbrite records them.
 */
export function eventbriteAttribution() {
  const stored = storedAttribution();
  const code = affiliateCode(stored);
  const promoCode = stored['promo']?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);
  const extraParams = Object.entries(stored)
    .filter(([name]) => name.startsWith('utm_'))
    .map(([name, value]) => ({ name, value: value.replace(/[&=#?+]/g, '_') })); // the widget only encodeURI()s these
  return {
    ...(code && { affiliateCode: code }),
    ...(promoCode && { promoCode }),
    ...(extraParams.length && { extraParams }),
  };
}
