import { trackVisitCfp, trackVisitPurchase } from './visit-tracker';

declare global {
    interface Window {
        gtag: any;
    }
}
export const trackTicketPurchase = function (orderData: any) {
    trackVisitPurchase(orderData.orderId);
    window.gtag('event', 'purchase', {
        transaction_id: orderData.orderId,
        value: 50.0,
        currency: 'USD',
        event_label: 'Ticket Sale',
    });
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
    } catch {}
}

export function storedAttribution(): Attribution {
    try {
        const { savedAt, ...stored } = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) ?? '{}');
        if (Date.now() - savedAt < ATTRIBUTION_DAYS * 24 * 60 * 60 * 1000) {
            return stored;
        }
    } catch {}
    return {};
}

/**
 * Options for EBWidgets.createWidget that carry the visitor's campaign into checkout. Eventbrite
 * reports orders by affiliate code (its `aff` tracking-link parameter), so an explicit `aff` wins,
 * otherwise the code is built from utm_source and utm_campaign, e.g. "linkedin-cfp_push".
 * The raw UTM parameters ride along too in case Eventbrite records them.
 */
export function eventbriteAttribution() {
    const stored = storedAttribution();
    const affiliateCode = (
        stored['aff'] ?? [stored['utm_source'], stored['utm_campaign']].filter(Boolean).join('-')
    )
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '_')
        .slice(0, 50);
    const extraParams = Object.entries(stored)
        .filter(([name]) => name.startsWith('utm_'))
        .map(([name, value]) => ({ name, value: value.replace(/[&=#?+]/g, '_') })); // the widget only encodeURI()s these
    return {
        ...(affiliateCode && { affiliateCode }),
        ...(extraParams.length && { extraParams }),
    };
}
