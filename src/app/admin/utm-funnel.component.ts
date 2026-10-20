import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ref } from 'firebase/database';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';
import { VisitSession } from '../shared/visit-session';
import { Dimension, funnelRows, totalRow } from './utm-funnel';

const GROUPINGS: { label: string; dimensions: Dimension[] }[] = [
    { label: 'Source / medium / campaign', dimensions: ['source', 'medium', 'campaign'] },
    { label: 'Source / medium', dimensions: ['source', 'medium'] },
    { label: 'Source', dimensions: ['source'] },
    { label: 'Campaign', dimensions: ['campaign'] },
];
/** Shown at the bottom of the page and as hover text on the tiles and column headers. */
const DEFINITIONS = {
    visit:
        'One visit to the public site. A visit ends after 30 minutes without a page view; admin pages are not counted.',
    engaged:
        'A visit that stayed on a page for 10 seconds while it was visible, viewed a second page, bought tickets, or clicked through to the call for papers form.',
    sales: 'A visit that completed at least one Eventbrite ticket order on the site.',
    cfp: 'A visit that clicked through to the external call for papers form.',
    credit:
        'Visits are credited to the last UTM campaign the visitor arrived from in the past 30 days (the same credit Eventbrite checkout gets). Without one, they go to the site that linked to them (medium "referral"), or to "(direct)".',
};
const RANGES = [
    { label: 'All time', days: 0 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 7 days', days: 7 },
    { label: 'Today', days: 1 },
];

@Component({
    template: `
        @if (auth.isAdmin()) {
        <div class="page-header">
            <div>
                <h2>UTM funnel</h2>
                <p class="muted">Visits to the public site and what they led to, by where they came from.</p>
            </div>
            <div class="filters">
                <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Group by</mat-label>
                    <mat-select [value]="grouping()" (valueChange)="grouping.set($event)">
                        @for (g of groupings; track g.label; let i = $index) {
                        <mat-option [value]="i">{{ g.label }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
                <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Dates</mat-label>
                    <mat-select [value]="range()" (valueChange)="range.set($event)">
                        @for (r of ranges; track r.label; let i = $index) {
                        <mat-option [value]="i">{{ r.label }}</mat-option>
                        }
                    </mat-select>
                </mat-form-field>
            </div>
        </div>

        <div class="tiles">
            <div class="tile" [title]="definitions.visit">
                <span class="label">Visits</span><span class="value">{{ total().visits | number }}</span>
            </div>
            <div class="tile" [title]="definitions.engaged">
                <span class="label">Engaged</span><span class="value">{{ total().engaged | number }}</span>
                <span class="note">{{ rate(total().engaged, total().visits) | percent: '1.0-1' }} of visits</span>
            </div>
            <div class="tile" [title]="definitions.sales">
                <span class="label">Ticket sales</span><span class="value">{{ total().sales | number }}</span>
                <span class="note">{{ rate(total().sales, total().engaged) | percent: '1.0-1' }} of engaged</span>
            </div>
            <div class="tile" [title]="definitions.cfp">
                <span class="label">CFP clicks</span><span class="value">{{ total().cfp | number }}</span>
                <span class="note">{{ rate(total().cfp, total().engaged) | percent: '1.0-1' }} of engaged</span>
            </div>
        </div>

        @if (rows().length) {
        <div class="table-wrap">
            <table class="data">
                <thead>
                    <tr>
                        @for (d of dimensions(); track d) {
                        <th scope="col" class="text key" [title]="definitions.credit">{{ d }}</th>
                        }
                        <th scope="col" [title]="definitions.visit">Visits</th>
                        <th scope="col" [title]="definitions.engaged">Engaged</th>
                        <th scope="col" title="Engaged visits as a share of visits">Engaged %</th>
                        <th scope="col" [title]="definitions.sales">Sales</th>
                        <th scope="col" title="Visits with a ticket sale as a share of visits">Sales %</th>
                        <th scope="col" [title]="definitions.cfp">CFP</th>
                        <th scope="col" title="Visits that clicked through to the call for papers form as a share of visits">CFP %</th>
                    </tr>
                </thead>
                <tbody>
                    @for (row of rows(); track row.keys.join()) {
                    <tr>
                        @for (key of row.keys; track $index) {
                        <td class="text">{{ key }}</td>
                        }
                        <td>{{ row.visits | number }}</td>
                        <td>{{ row.engaged | number }}</td>
                        <td>{{ rate(row.engaged, row.visits) | percent: '1.0-1' }}</td>
                        <td>{{ row.sales | number }}</td>
                        <td>{{ rate(row.sales, row.visits) | percent: '1.0-1' }}</td>
                        <td>{{ row.cfp | number }}</td>
                        <td>{{ rate(row.cfp, row.visits) | percent: '1.0-1' }}</td>
                    </tr>
                    }
                </tbody>
            </table>
        </div>
        } @else {
        <p class="muted">No visits recorded for these dates yet.</p>
        }

        <section class="card definitions" aria-labelledby="definitions-heading">
            <h3 id="definitions-heading">What these mean</h3>
            <dl>
                <dt>Visit</dt>
                <dd>{{ definitions.visit }}</dd>
                <dt>Engaged</dt>
                <dd>{{ definitions.engaged }}</dd>
                <dt>Ticket sale</dt>
                <dd>{{ definitions.sales }}</dd>
                <dt>CFP click</dt>
                <dd>{{ definitions.cfp }}</dd>
                <dt>Source, medium, campaign</dt>
                <dd>{{ definitions.credit }}</dd>
            </dl>
        </section>
        }
    `,
    styles: `
        :host { display: block; }
        .filters { display: flex; flex-wrap: wrap; gap: 12px; }
        .filters mat-form-field { width: 220px; }
        .key { text-transform: capitalize; }
        [title] { cursor: help; }
        .definitions { margin-top: 32px; }
        dl { display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 0; max-width: 820px; }
        dt { font: var(--mat-sys-title-small); }
        dd { margin: 0; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
        @media (max-width: 640px) { dl { grid-template-columns: 1fr; } dd { margin-bottom: 8px; } }
    `,
    imports: [DecimalPipe, PercentPipe, MatFormFieldModule, MatSelectModule],
})
export class UtmFunnelComponent {
    auth = inject(AuthService);
    db = inject(DATABASE);

    readonly groupings = GROUPINGS;
    readonly ranges = RANGES;
    readonly definitions = DEFINITIONS;
    grouping = signal(0);
    range = signal(0);

    sessions = objectResource<Record<string, VisitSession>>(
        () =>
            this.auth.isAdmin()
                ? ref(this.db, `analytics/${environment.year}/sessions`)
                : undefined,
        { initialValue: {} }
    );

    dimensions = computed(() => GROUPINGS[this.grouping()].dimensions);
    /** First day in the range, in Central time like the stored days. */
    sinceDay = computed(() => {
        const days = RANGES[this.range()].days;
        if (!days) return undefined;
        return new Date(Date.now() - (days - 1) * 86_400_000).toLocaleDateString('en-CA', {
            timeZone: 'America/Chicago',
        });
    });
    rows = computed(() =>
        funnelRows(Object.values(this.sessions()), this.dimensions(), this.sinceDay())
    );
    total = computed(() => totalRow(this.rows()));

    rate(part: number, whole: number) {
        return whole ? part / whole : 0;
    }
}
