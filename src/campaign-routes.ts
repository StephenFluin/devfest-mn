import express, { type Express } from 'express';
import QRCode from 'qrcode';
import { environment } from './environments/environment';
import {
  CAMPAIGN_SLUG,
  CampaignLink,
  campaignRedirect,
  campaignUrl,
  PROMO_CODE,
} from './app/shared/campaign';
import { SESSION_KEY } from './app/speaker-invite/speaker-session-edit';
import { SPEAKER_PROMO_PERCENT, speakerPromoCode } from './app/shared/slug';
import { svgToPng } from './speaker-card';
import {
  eventbrite,
  eventbriteToken,
  publicDatabase,
  rateLimiter,
  readJson,
  requireAdmin,
} from './server-helpers';

/**
 * Campaign short links. /go/<slug> sends people to the site tagged with the campaign's UTM
 * parameters, its Eventbrite affiliate code (the slug) and promo code, so the admin Campaigns page
 * can show visits, ticket sales and revenue per campaign. /go/<slug>.png is a QR code for the link,
 * for posters and slides.
 */
export function addCampaignRoutes(app: Express) {
  let links: { at: number; value: Promise<Record<string, CampaignLink>> } | undefined;

  /** The public half of every campaign, cached briefly so a new link works within a minute. */
  const loadLinks = () => {
    if (!links || Date.now() - links.at > 60_000) {
      const value = readJson<Record<string, CampaignLink> | null>(
        publicDatabase(`marketing/${environment.year}/links`),
      )
        .then((result) => result ?? {})
        .catch((error) => {
          links = undefined;
          throw error;
        });
      links = { at: Date.now(), value };
    }
    return links.value;
  };

  app.get('/go/:slug', async (req, res) => {
    // A 302 rather than a 301, because browsers cache 301s forever and the tags may change.
    res.set('Cache-Control', 'no-store');
    try {
      const match = req.params.slug.match(/^([a-z0-9-]{2,40})(\.png)?$/);
      const slug = match?.[1];
      const link = slug && CAMPAIGN_SLUG.test(slug) ? (await loadLinks())[slug] : undefined;
      if (!link) {
        if (match?.[2]) {
          res.status(404).end();
        } else {
          res.redirect(302, '/');
        }
        return;
      }
      if (match[2]) {
        await sendQrCode(res, slug);
        return;
      }
      res.redirect(302, campaignRedirect(slug, link));
    } catch (error) {
      console.error('Error resolving campaign link:', error);
      res.redirect(302, '/');
    }
  });

  const qrCodes = new Map<string, Promise<Uint8Array>>();

  /** A 600px QR code of the short link; black on white so it prints and scans well. */
  async function sendQrCode(res: express.Response, slug: string) {
    let png = qrCodes.get(slug);
    if (!png) {
      png = QRCode.toString(campaignUrl(slug), {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
      }).then((svg) => svgToPng(svg, 600));
      png.catch(() => qrCodes.delete(slug));
      if (qrCodes.size >= 200) qrCodes.clear();
      qrCodes.set(slug, png);
    }
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Disposition', `inline; filename="devfestmn-${slug}-qr.png"`);
    res.type('image/png').send(Buffer.from(await png));
  }

  const discountLimit = rateLimiter(10, 60_000, 'promo codes');
  let organizationId: Promise<string> | undefined;

  /** The organization that owns the token; discounts belong to it rather than to the event. */
  const organization = (token: string) => {
    organizationId ??= eventbrite<{ organizations: { id: string }[] }>(
      token,
      '/users/me/organizations/',
    )
      .then((result) => {
        const id = result.organizations[0]?.id;
        if (!id) throw new Error('The Eventbrite token has no organization');
        return id;
      })
      .catch((error) => {
        organizationId = undefined;
        throw error;
      });
    return organizationId;
  };

  /** Creates a coded discount on this year's event, and returns its id. */
  const createDiscount = async (
    token: string,
    code: string,
    percentOff: number,
    quantity?: number,
  ) =>
    (
      await eventbrite<{ id: string }>(
        token,
        `/organizations/${await organization(token)}/discounts/`,
        {
          method: 'POST',
          body: JSON.stringify({
            discount: {
              type: 'coded',
              code,
              percent_off: percentOff.toFixed(2),
              event_id: environment.eventbriteEventId,
              ...(quantity !== undefined && { quantity_available: quantity }),
            },
          }),
        },
      )
    ).id;

  /**
   * Creates the campaign's promo code in Eventbrite as a coded discount on this year's event, and
   * records the discount's id on the campaign. The campaign itself is saved by the admin in the
   * browser; this only does the part that needs the Eventbrite token.
   */
  app.post(
    '/api/admin/campaigns/:slug/discount',
    express.json({ limit: '4kb' }),
    async (req, res) => {
      try {
        if (!discountLimit(res)) return;
        const admin = await requireAdmin(req, res, 'create promo codes');
        if (!admin) return;
        const slug = req.params.slug;
        const code = String(req.body?.code ?? '').trim();
        const percentOff = Number(req.body?.percentOff);
        const quantity = req.body?.quantity == null ? undefined : Number(req.body.quantity);
        if (!CAMPAIGN_SLUG.test(slug)) {
          res.status(400).json({ error: 'Not a campaign slug' });
          return;
        }
        if (!PROMO_CODE.test(code)) {
          res.status(400).json({ error: 'Promo codes are 2 to 30 letters, digits, - or _' });
          return;
        }
        if (!(percentOff > 0 && percentOff <= 100)) {
          res.status(400).json({ error: 'Percent off must be between 1 and 100' });
          return;
        }
        if (quantity !== undefined && !(Number.isInteger(quantity) && quantity > 0)) {
          res.status(400).json({ error: 'Quantity must be a whole number' });
          return;
        }
        const campaignPath = `marketing/${environment.year}/campaigns/${slug}`;
        const campaign = await readJson<{ discountId?: string } | null>(
          await admin.db(campaignPath),
        );
        if (!campaign) {
          res.status(404).json({ error: 'Save the campaign first' });
          return;
        }
        if (campaign.discountId) {
          res.status(409).json({ error: 'This campaign already has a promo code in Eventbrite' });
          return;
        }
        const token = eventbriteToken();
        if (!token) {
          res.status(500).json({ error: 'EVENTBRITE_TOKEN is not configured' });
          return;
        }
        const discountId = await createDiscount(token, code, percentOff, quantity);
        await readJson(
          await admin.db(campaignPath, {
            method: 'PATCH',
            body: JSON.stringify({
              discountId,
              percentOff,
              promoQuantity: quantity ?? null,
            }),
          }),
        );
        res.json({ discountId });
      } catch (error) {
        console.error('Error creating promo code:', error);
        // Eventbrite explains rejected codes (e.g. one that already exists) in its response.
        const detail = String(error?.message ?? '').match(/"error_description":\s*"([^"]+)"/)?.[1];
        res.status(502).json({ error: detail ?? 'Unable to create the promo code in Eventbrite' });
      }
    },
  );

  /**
   * Gives a speaker their promo code when they're created: unlimited uses, on every ticket type.
   * Safe to repeat. If an earlier try created the code but didn't save it, this picks it up.
   */
  app.post('/api/admin/speakers/:key/promo-code', async (req, res) => {
    try {
      if (!discountLimit(res)) return;
      const admin = await requireAdmin(req, res, 'create promo codes');
      if (!admin) return;
      const key = req.params.key;
      if (!SESSION_KEY.test(key)) {
        res.status(400).json({ error: 'Not a speaker key' });
        return;
      }
      const path = `devfest${environment.year}/speakers/${key}`;
      const speaker = await readJson<{ name?: string; promoCode?: string } | null>(
        await admin.db(path),
      );
      if (!speaker) {
        res.status(404).json({ error: 'No such speaker' });
        return;
      }
      if (speaker.promoCode) {
        res.json({ promoCode: speaker.promoCode });
        return;
      }
      const code = speakerPromoCode(speaker.name);
      if (!PROMO_CODE.test(code)) {
        res.status(409).json({ error: `Can't make a promo code from the name "${speaker.name}"` });
        return;
      }
      const token = eventbriteToken();
      if (!token) {
        res.status(500).json({ error: 'EVENTBRITE_TOKEN is not configured' });
        return;
      }
      const existing = await eventbrite<{ discounts?: { code?: string }[] }>(
        token,
        `/organizations/${await organization(token)}/discounts/` +
          `?scope=event&event_id=${environment.eventbriteEventId}&code=${code}`,
      );
      if (!existing.discounts?.some((discount) => discount.code === code)) {
        await createDiscount(token, code, SPEAKER_PROMO_PERCENT);
      }
      await readJson(
        await admin.db(path, { method: 'PATCH', body: JSON.stringify({ promoCode: code }) }),
      );
      res.json({ promoCode: code });
    } catch (error) {
      console.error('Error creating speaker promo code:', error);
      const detail = String(error?.message ?? '').match(/"error_description":\s*"([^"]+)"/)?.[1];
      res.status(502).json({ error: detail ?? 'Unable to create the promo code in Eventbrite' });
    }
  });
}
