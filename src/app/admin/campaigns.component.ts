import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ref, serverTimestamp, update } from 'firebase/database';

import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';
import {
  BurndownOrder,
  Campaign,
  CAMPAIGN_PRESETS,
  CAMPAIGN_SLUG,
  CampaignLink,
  CampaignStats,
  campaignQrUrl,
  campaignStats,
  campaignUrl,
  discountKey,
  DiscountUsage,
  PROMO_CODE,
} from '../shared/campaign';
import { DataService } from '../shared/data.service';
import { slugify } from '../shared/slug';
import { VisitSession } from '../shared/visit-session';
import { syncEventbrite } from './eventbrite-sync';

interface CampaignRow {
  slug: string;
  link: CampaignLink;
  campaign: Campaign;
  stats: CampaignStats;
  url: string;
  qrUrl: string;
}

/** The form's fields; `slug` is fixed once a campaign exists. */
interface CampaignForm {
  slug: string;
  name: string;
  preset: string;
  source: string;
  medium: string;
  campaign: string;
  landing: string;
  promo: string;
  percentOff: number | null;
  promoQuantity: number | null;
  spend: number | null;
  notes: string;
}

const EMPTY_FORM: CampaignForm = {
  slug: '',
  name: '',
  preset: '',
  source: '',
  medium: '',
  campaign: '',
  landing: '/',
  promo: '',
  percentOff: null,
  promoQuantity: null,
  spend: null,
  notes: '',
};

/**
 * Loops that run on their own: links the site hands to new ticket holders and to speakers. They
 * aren't campaigns in the database, but they're measured the same way.
 */
const BUILT_IN = [
  {
    label: 'Attendee shares',
    source: 'attendee',
    description: 'Posts from the "You’re in!" prompt after buying a ticket.',
  },
  {
    label: 'Speaker shares',
    source: 'speaker',
    description: 'Visits through speakers’ /s/ links and share kits.',
  },
];

@Component({
  template: `
    @if (auth.isAdmin()) {
      <div class="page-header">
        <div>
          <h2>Campaigns</h2>
          <p class="muted">
            One short link per place DevFestMN is promoted. Each link tags its visits for the UTM
            funnel and its ticket orders in Eventbrite, so you can see what each channel brings.
          </p>
        </div>
        <div class="actions">
          @if (syncMessage()) {
            <span class="status" role="status">{{ syncMessage() }}</span>
          }
          <button mat-stroked-button type="button" (click)="sync()" [disabled]="syncing()">
            {{ syncing() ? 'Updating…' : 'Update from Eventbrite' }}
          </button>
        </div>
      </div>

      <div class="tiles">
        <div class="tile">
          <span class="label">Campaigns</span>
          <span class="value">{{ rows().length }}</span>
        </div>
        <div class="tile">
          <span class="label">Visits from campaigns</span>
          <span class="value">{{ totals().visits | number }}</span>
        </div>
        <div class="tile">
          <span class="label">Tickets from campaigns</span>
          <span class="value">{{ totals().tickets | number }}</span>
          <span class="note">{{ totals().revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
        </div>
        <div class="tile">
          <span class="label">Spend</span>
          <span class="value">{{ totals().spend | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
          @if (totals().costPerTicket; as cost) {
            <span class="note">{{ cost | currency: 'USD' }} per ticket</span>
          }
        </div>
      </div>

      <form class="card" (submit)="save($event)" autocomplete="off" aria-labelledby="form-heading">
        <h3 id="form-heading">{{ editing() ? 'Edit campaign' : 'New campaign' }}</h3>
        <div class="field-grid">
          <mat-form-field>
            <mat-label>Where will the link go?</mat-label>
            <mat-select
              [value]="form().preset"
              (valueChange)="applyPreset($event)"
              [disabled]="!!editing()"
            >
              @for (preset of presets; track preset.id) {
                <mat-option [value]="preset.id">{{ preset.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Name</mat-label>
            <input
              matInput
              name="name"
              [ngModel]="form().name"
              (ngModelChange)="setName($event)"
              required
              maxlength="80"
              placeholder="e.g. Minnesota JS meetup"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Short link</mat-label>
            <span matTextPrefix>{{ siteUrl }}/go/&nbsp;</span>
            <input
              matInput
              name="slug"
              [ngModel]="form().slug"
              (ngModelChange)="set('slug', $event); slugEdited = true"
              required
              pattern="[a-z0-9][a-z0-9-]{1,39}"
              [disabled]="!!editing()"
            />
            <mat-hint
              >Lowercase letters, digits and dashes. Also the Eventbrite affiliate code.</mat-hint
            >
          </mat-form-field>
          <mat-form-field>
            <mat-label>Landing page</mat-label>
            <input
              matInput
              name="landing"
              [ngModel]="form().landing"
              (ngModelChange)="set('landing', $event)"
              required
              pattern="/.*"
            />
            <mat-hint>A path on the site, like / or /speakers</mat-hint>
          </mat-form-field>
          <mat-form-field>
            <mat-label>utm_source</mat-label>
            <input
              matInput
              name="source"
              [ngModel]="form().source"
              (ngModelChange)="set('source', $event)"
              required
              maxlength="50"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>utm_medium</mat-label>
            <input
              matInput
              name="medium"
              [ngModel]="form().medium"
              (ngModelChange)="set('medium', $event)"
              required
              maxlength="50"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>utm_campaign</mat-label>
            <input
              matInput
              name="campaign"
              [ngModel]="form().campaign"
              (ngModelChange)="set('campaign', $event)"
              maxlength="80"
              [placeholder]="form().slug || 'same as the short link'"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Spend so far (USD)</mat-label>
            <input
              matInput
              name="spend"
              type="number"
              min="0"
              step="0.01"
              [ngModel]="form().spend"
              (ngModelChange)="set('spend', $event)"
            />
            <mat-hint>For ads or printing; gives cost per ticket.</mat-hint>
          </mat-form-field>
        </div>

        <h4>Promo code <span class="muted">(optional)</span></h4>
        <p class="muted">
          Created in Eventbrite as a coded discount and applied automatically when someone follows
          the link, so the partner's audience gets the deal and you see how many used it.
        </p>
        <div class="field-grid promo">
          <mat-form-field>
            <mat-label>Code</mat-label>
            <input
              matInput
              name="promo"
              [ngModel]="form().promo"
              (ngModelChange)="set('promo', $event.toUpperCase())"
              pattern="[A-Za-z0-9_-]{2,30}"
              [disabled]="!!editing()?.discountId"
              placeholder="e.g. MNJS20"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Percent off</mat-label>
            <input
              matInput
              name="percentOff"
              type="number"
              min="1"
              max="100"
              [ngModel]="form().percentOff"
              (ngModelChange)="set('percentOff', $event)"
              [disabled]="!!editing()?.discountId"
            />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Uses available</mat-label>
            <input
              matInput
              name="promoQuantity"
              type="number"
              min="1"
              [ngModel]="form().promoQuantity"
              (ngModelChange)="set('promoQuantity', $event)"
              [disabled]="!!editing()?.discountId"
              placeholder="unlimited"
            />
          </mat-form-field>
        </div>

        <mat-form-field class="notes">
          <mat-label>Notes</mat-label>
          <textarea
            matInput
            name="notes"
            [ngModel]="form().notes"
            (ngModelChange)="set('notes', $event)"
            rows="2"
            maxlength="1000"
            placeholder="Who you talked to, when it ran, what you promised them"
          ></textarea>
        </mat-form-field>

        @if (presetHint(); as hint) {
          <p class="notice">{{ hint }}</p>
        }

        <div class="actions">
          <button mat-flat-button type="submit" [disabled]="saving() || !valid()">
            {{ editing() ? 'Save campaign' : 'Create campaign' }}
          </button>
          @if (editing()) {
            <button mat-button type="button" (click)="reset()">Cancel</button>
          }
          @if (message()) {
            <span class="status" [class.error]="failed()" [class.ok]="!failed()" role="status">{{
              message()
            }}</span>
          }
        </div>
      </form>

      @if (rows().length) {
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th scope="col" class="text">Campaign</th>
                <th scope="col" class="text">Link</th>
                <th scope="col" class="text">Promo</th>
                <th scope="col" title="Visits that arrived through the link">Visits</th>
                <th scope="col" title="Visits that stayed, viewed a second page or bought">
                  Engaged
                </th>
                <th scope="col" title="Visits that completed a ticket order on the site">Sales</th>
                <th scope="col" title="Tickets Eventbrite credits to this campaign's code">
                  Tickets
                </th>
                <th scope="col" title="Ticket revenue for those tickets, before fees">Revenue</th>
                <th scope="col">Spend</th>
                <th scope="col" title="Spend divided by tickets">Per ticket</th>
                <th scope="col"><span class="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.slug) {
                <tr>
                  <td class="text">
                    <strong>{{ row.campaign.name || row.slug }}</strong>
                    <div class="muted">
                      {{ row.link.source }} / {{ row.link.medium }}
                      @if (row.campaign.preset) {
                        · {{ presetLabel(row.campaign.preset) }}
                      }
                    </div>
                  </td>
                  <td class="text">
                    <code>/go/{{ row.slug }}</code>
                    <div class="link-actions">
                      <button mat-button type="button" (click)="copy(row)">
                        {{ copied() === row.slug ? 'Copied' : 'Copy link' }}
                      </button>
                      <a mat-button [href]="row.qrUrl" target="_blank" rel="noopener">QR code</a>
                    </div>
                  </td>
                  <td class="text">
                    @if (row.link.promo) {
                      <code>{{ row.link.promo }}</code>
                      <div class="muted">
                        @if (row.campaign.discountId) {
                          {{ row.campaign.percentOff }}% off · used {{ row.stats.promoUsed ?? 0 }}
                          @if (row.campaign.promoQuantity) {
                            of {{ row.campaign.promoQuantity }}
                          }
                        } @else {
                          <span class="error">Not in Eventbrite yet</span>
                          <button mat-button type="button" (click)="createDiscount(row)">
                            Create
                          </button>
                        }
                      </div>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td>{{ row.stats.visits | number }}</td>
                  <td>{{ row.stats.engaged | number }}</td>
                  <td>{{ row.stats.sales | number }}</td>
                  <td>{{ row.stats.tickets | number }}</td>
                  <td>{{ row.stats.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                  <td>
                    {{
                      row.stats.spend
                        ? (row.stats.spend | currency: 'USD' : 'symbol' : '1.0-0')
                        : '—'
                    }}
                  </td>
                  <td>
                    {{
                      row.stats.costPerTicket ? (row.stats.costPerTicket | currency: 'USD') : '—'
                    }}
                  </td>
                  <td>
                    <button mat-button type="button" (click)="edit(row)">Edit</button>
                    <button mat-button class="danger" type="button" (click)="remove(row)">
                      Delete
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="muted">
          No campaigns yet. Create one above for each place you promote the event, starting with the
          meetups and communities where Twin Cities developers already are.
        </p>
      }

      <section class="card built-in" aria-labelledby="built-in-heading">
        <h3 id="built-in-heading">Word of mouth</h3>
        <p class="muted">
          Links the site hands out on its own, measured the same way as campaigns.
        </p>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th scope="col" class="text">Loop</th>
                <th scope="col">Visits</th>
                <th scope="col">Engaged</th>
                <th scope="col">Sales</th>
                <th scope="col">Tickets</th>
                <th scope="col">Revenue</th>
                <th scope="col" title="Tickets bought with a speaker's promo code">Code uses</th>
              </tr>
            </thead>
            <tbody>
              @for (loop of builtIn(); track loop.source) {
                <tr>
                  <td class="text">
                    <strong>{{ loop.label }}</strong>
                    <div class="muted">{{ loop.description }}</div>
                  </td>
                  <td>{{ loop.visits | number }}</td>
                  <td>{{ loop.engaged | number }}</td>
                  <td>{{ loop.sales | number }}</td>
                  <td>{{ loop.tickets | number }}</td>
                  <td>{{ loop.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                  <td>{{ loop.source === 'speaker' ? (speakerCodeUses() | number) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="card definitions" aria-labelledby="how-heading">
        <h3 id="how-heading">How it works</h3>
        <dl>
          <dt>Short link</dt>
          <dd>
            {{ siteUrl }}/go/&lt;slug&gt; opens the landing page with utm_source, utm_medium and
            utm_campaign set, and remembers the campaign for 30 days (like the UTM funnel).
          </dd>
          <dt>Tickets and revenue</dt>
          <dd>
            Checkout tells Eventbrite the campaign's slug as its affiliate code. "Update from
            Eventbrite" copies the orders back, so these columns are Eventbrite's own numbers, even
            when the ticket was bought on a later visit or another device.
          </dd>
          <dt>Visits, engaged, sales</dt>
          <dd>
            From the site's own analytics, like the UTM funnel: sales there are orders completed
            during a tagged visit, so they can be lower than Eventbrite's tickets.
          </dd>
          <dt>QR code</dt>
          <dd>
            A printable PNG of the short link, for posters, slides and flyers. Each place gets its
            own campaign so you know which poster worked.
          </dd>
        </dl>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    h4 {
      margin: 16px 0 4px;
      font: var(--mat-sys-title-medium);
    }
    .promo {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .notes {
      margin-top: 8px;
    }
    .notice {
      margin: 8px 0 16px;
    }
    .link-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }
    .built-in,
    .definitions {
      margin-top: 32px;
    }
    .built-in .table-wrap {
      border: 0;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 24px;
      margin: 0;
      max-width: 820px;
    }
    dt {
      font: var(--mat-sys-title-small);
    }
    dd {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-medium);
    }
    @media (max-width: 640px) {
      dl {
        grid-template-columns: 1fr;
      }
    }
  `,
  imports: [
    CurrencyPipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [DatePipe],
})
export class CampaignsComponent {
  auth = inject(AuthService);
  private db = inject(DATABASE);

  readonly siteUrl = environment.siteUrl;
  readonly presets = CAMPAIGN_PRESETS;
  private readonly base = `marketing/${environment.year}`;

  private links = objectResource<Record<string, CampaignLink> | null>(
    () => (this.auth.isAdmin() ? ref(this.db, `${this.base}/links`) : undefined),
    { initialValue: null },
  );
  private campaigns = objectResource<Record<string, Campaign> | null>(
    () => (this.auth.isAdmin() ? ref(this.db, `${this.base}/campaigns`) : undefined),
    { initialValue: null },
  );
  private sessions = objectResource<Record<string, VisitSession> | null>(
    () =>
      this.auth.isAdmin() ? ref(this.db, `analytics/${environment.year}/sessions`) : undefined,
    { initialValue: null },
  );
  private ds = inject(DataService);
  private burndown = objectResource<{
    orders?: Record<string, BurndownOrder> | BurndownOrder[];
    discounts?: Record<string, DiscountUsage>;
  } | null>(
    () => (this.auth.isAdmin() ? ref(this.db, `burndown/${environment.year}`) : undefined),
    { initialValue: null },
  );

  private sessionList = computed(() => Object.values(this.sessions() ?? {}));
  private orderList = computed(() => Object.values(this.burndown()?.orders ?? {}));

  rows = computed<CampaignRow[]>(() =>
    Object.entries(this.links() ?? {})
      .map(([slug, link]) => {
        const campaign = this.campaigns()?.[slug] ?? { name: slug };
        return {
          slug,
          link,
          campaign,
          stats: campaignStats(
            slug,
            link,
            campaign,
            this.sessionList(),
            this.orderList(),
            this.burndown()?.discounts ?? {},
          ),
          url: campaignUrl(slug),
          qrUrl: campaignQrUrl(slug),
        };
      })
      .sort(
        (a, b) =>
          b.stats.tickets - a.stats.tickets ||
          b.stats.visits - a.stats.visits ||
          (b.campaign.createdAt ?? 0) - (a.campaign.createdAt ?? 0),
      ),
  );

  totals = computed(() => {
    const total = { visits: 0, tickets: 0, revenue: 0, spend: 0, costPerTicket: 0 };
    for (const { stats } of this.rows()) {
      total.visits += stats.visits;
      total.tickets += stats.tickets;
      total.revenue += stats.revenue;
      total.spend += stats.spend;
    }
    total.costPerTicket = total.spend && total.tickets ? total.spend / total.tickets : 0;
    return total;
  });

  /** Attendee and speaker share links: visits by utm_source, orders by affiliate code prefix. */
  speakerCodeUses = computed(() => {
    const discounts = this.burndown()?.discounts ?? {};
    return this.ds
      .speakers()
      .reduce(
        (uses, { promoCode }) =>
          uses + (promoCode ? (discounts[discountKey(promoCode)]?.sold ?? 0) : 0),
        0,
      );
  });

  builtIn = computed(() =>
    BUILT_IN.map((loop) => {
      const row = { ...loop, visits: 0, engaged: 0, sales: 0, tickets: 0, revenue: 0 };
      for (const session of this.sessionList()) {
        if (session.utm_source !== loop.source) continue;
        row.visits++;
        if (session.engaged) row.engaged++;
        if (session.orders && Object.keys(session.orders).length) row.sales++;
      }
      for (const order of this.orderList()) {
        if (!order.affiliate?.startsWith(`${loop.source}-`)) continue;
        row.tickets += order.tickets ?? 0;
        row.revenue += order.price ?? 0;
      }
      return row;
    }),
  );

  form = signal<CampaignForm>({ ...EMPTY_FORM });
  /** The campaign being edited, or null for a new one. */
  editing = signal<Campaign | null>(null);
  slugEdited = false;
  saving = signal(false);
  message = signal('');
  failed = signal(false);
  copied = signal<string | null>(null);
  syncing = signal(false);
  syncMessage = signal('');

  presetHint = computed(() => this.presets.find((p) => p.id === this.form().preset)?.hint);
  presetLabel = (id: string) => this.presets.find((p) => p.id === id)?.label ?? id;

  valid = computed(() => {
    const form = this.form();
    const promoOk =
      !form.promo ||
      (PROMO_CODE.test(form.promo) &&
        form.percentOff > 0 &&
        form.percentOff <= 100 &&
        (form.promoQuantity == null || form.promoQuantity > 0));
    return (
      !!form.name.trim() &&
      CAMPAIGN_SLUG.test(form.slug) &&
      !!form.source.trim() &&
      !!form.medium.trim() &&
      form.landing.startsWith('/') &&
      promoOk
    );
  });

  set<K extends keyof CampaignForm>(field: K, value: CampaignForm[K]) {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  setName(name: string) {
    this.form.update((form) => ({
      ...form,
      name,
      slug: this.slugEdited || this.editing() ? form.slug : slugify(name).slice(0, 40),
    }));
  }

  applyPreset(id: string) {
    const preset = this.presets.find((p) => p.id === id);
    if (!preset) return;
    this.form.update((form) => ({
      ...form,
      preset: id,
      source: preset.source,
      medium: preset.medium,
    }));
  }

  edit(row: CampaignRow) {
    this.editing.set({ ...row.campaign, $key: row.slug });
    this.form.set({
      slug: row.slug,
      name: row.campaign.name ?? '',
      preset: row.campaign.preset ?? '',
      source: row.link.source,
      medium: row.link.medium,
      campaign: row.link.campaign === row.slug ? '' : row.link.campaign,
      landing: row.link.landing,
      promo: row.link.promo ?? '',
      percentOff: row.campaign.percentOff ?? null,
      promoQuantity: row.campaign.promoQuantity ?? null,
      spend: row.campaign.spend ?? null,
      notes: row.campaign.notes ?? '',
    });
    this.message.set('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reset() {
    this.editing.set(null);
    this.form.set({ ...EMPTY_FORM });
    this.slugEdited = false;
    this.message.set('');
  }

  async save(event: Event) {
    event.preventDefault();
    if (!this.valid() || this.saving()) return;
    const form = this.form();
    const slug = form.slug;
    const existing = this.editing();
    if (!existing && this.links()?.[slug]) {
      this.fail(`There's already a campaign at /go/${slug}. Pick another short link.`);
      return;
    }
    this.saving.set(true);
    this.message.set('');
    try {
      const me = this.auth.auth?.currentUser;
      const link: CampaignLink = {
        source: form.source.trim(),
        medium: form.medium.trim(),
        campaign: form.campaign.trim() || slug,
        landing: form.landing.trim() || '/',
        ...(form.promo && { promo: form.promo.trim() }),
      };
      const campaign = {
        name: form.name.trim(),
        preset: form.preset || null,
        notes: form.notes.trim() || null,
        spend: form.spend ?? null,
        percentOff: form.promo ? form.percentOff : null,
        promoQuantity: form.promo ? (form.promoQuantity ?? null) : null,
        discountId: existing?.discountId ?? null,
        createdAt: existing?.createdAt ?? serverTimestamp(),
        createdBy: existing?.createdBy ?? me?.email ?? null,
      };
      await update(ref(this.db), {
        [`${this.base}/links/${slug}`]: link,
        [`${this.base}/campaigns/${slug}`]: campaign,
      });
      this.failed.set(false);
      if (link.promo && !existing?.discountId) {
        this.message.set('Saved. Creating the promo code in Eventbrite…');
        await this.requestDiscount(slug, link.promo, form.percentOff, form.promoQuantity);
      } else {
        this.message.set(existing ? 'Saved.' : `Created ${campaignUrl(slug)}`);
      }
      if (!this.failed()) this.reset();
    } catch (error) {
      console.error('Error saving campaign', error);
      this.fail(`Couldn't save: ${error.message ?? error}`);
    } finally {
      this.saving.set(false);
    }
  }

  /** Retries creating a saved campaign's promo code in Eventbrite. */
  async createDiscount(row: CampaignRow) {
    if (!row.link.promo || !row.campaign.percentOff) {
      this.edit(row);
      this.fail('Set the percent off, then save to create the code.');
      return;
    }
    this.saving.set(true);
    this.message.set('');
    try {
      await this.requestDiscount(
        row.slug,
        row.link.promo,
        row.campaign.percentOff,
        row.campaign.promoQuantity ?? null,
      );
    } finally {
      this.saving.set(false);
    }
  }

  private async requestDiscount(
    slug: string,
    code: string,
    percentOff: number,
    quantity: number | null,
  ) {
    try {
      const idToken = await this.auth.auth?.currentUser?.getIdToken();
      const response = await fetch(`/api/admin/campaigns/${slug}/discount`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, percentOff, quantity: quantity ?? undefined }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.error ?? `Eventbrite request failed (${response.status})`);
      this.failed.set(false);
      this.message.set(`Saved, and ${code} is live in Eventbrite.`);
    } catch (error) {
      this.fail(
        `Saved the campaign, but the promo code wasn't created: ${error.message ?? error}. Use "Create" in the table to retry.`,
      );
    }
  }

  async remove(row: CampaignRow) {
    const note = row.campaign.discountId
      ? ' Its promo code stays in Eventbrite until you remove it there.'
      : '';
    if (
      !confirm(
        `Delete the campaign "${row.campaign.name || row.slug}"? The link will stop working.${note}`,
      )
    )
      return;
    try {
      await update(ref(this.db), {
        [`${this.base}/links/${row.slug}`]: null,
        [`${this.base}/campaigns/${row.slug}`]: null,
      });
      if (this.editing()?.$key === row.slug) this.reset();
    } catch (error) {
      this.fail(`Couldn't delete: ${error.message ?? error}`);
    }
  }

  async copy(row: CampaignRow) {
    try {
      await navigator.clipboard.writeText(row.url);
      this.copied.set(row.slug);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      prompt('Copy this link:', row.url);
    }
  }

  async sync() {
    this.syncing.set(true);
    this.syncMessage.set('');
    try {
      this.syncMessage.set(await syncEventbrite(this.auth));
    } catch (error) {
      this.syncMessage.set(error.message ?? 'Update failed');
    } finally {
      this.syncing.set(false);
    }
  }

  private fail(message: string) {
    this.failed.set(true);
    this.message.set(message);
  }
}
