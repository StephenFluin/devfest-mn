import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { ref } from 'firebase/database';

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
        <h2>UTM funnel</h2>
        <div class="toolbar">
            <label>
                Group by
                <select (change)="grouping.set(+$any($event.target).value)">
                    @for (g of groupings; track g.label; let i = $index) {
                    <option [value]="i">{{ g.label }}</option>
                    }
                </select>
            </label>
            <label>
                Dates
                <select (change)="range.set(+$any($event.target).value)">
                    @for (r of ranges; track r.label; let i = $index) {
                    <option [value]="i">{{ r.label }}</option>
                    }
                </select>
            </label>
        </div>

        <div class="tiles">
            <div [title]="definitions.visit"><span>Visits</span><b>{{ total().visits | number }}</b></div>
            <div [title]="definitions.engaged">
                <span>Engaged</span><b>{{ total().engaged | number }}</b>
                <small>{{ rate(total().engaged, total().visits) | percent: '1.0-1' }} of visits</small>
            </div>
            <div [title]="definitions.sales">
                <span>Ticket sales</span><b>{{ total().sales | number }}</b>
                <small>{{ rate(total().sales, total().engaged) | percent: '1.0-1' }} of engaged</small>
            </div>
            <div [title]="definitions.cfp">
                <span>CFP clicks</span><b>{{ total().cfp | number }}</b>
                <small>{{ rate(total().cfp, total().engaged) | percent: '1.0-1' }} of engaged</small>
            </div>
        </div>

        @if (rows().length) {
        <div class="scroll">
            <table>
                <thead>
                    <tr>
                        @for (d of dimensions(); track d) {
                        <th class="key" [title]="definitions.credit">{{ d }}</th>
                        }
                        <th [title]="definitions.visit">Visits</th>
                        <th [title]="definitions.engaged">Engaged</th>
                        <th title="Engaged visits as a share of visits">Engaged %</th>
                        <th [title]="definitions.sales">Sales</th>
                        <th title="Visits with a ticket sale as a share of visits">Sales %</th>
                        <th [title]="definitions.cfp">CFP</th>
                        <th title="Visits that clicked through to the call for papers form as a share of visits">CFP %</th>
                    </tr>
                </thead>
                <tbody>
                    @for (row of rows(); track row.keys.join()) {
                    <tr>
                        @for (key of row.keys; track $index) {
                        <td class="key">{{ key }}</td>
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

        <dl class="muted">
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
        }
    `,
    styles: `
        :host { display: block; max-width: 960px; }
        .muted, span, small { color: #52514e; font-size: 13px; }
        .toolbar { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0; }
        select { margin-left: 4px; font: inherit; }
        .tiles { display: flex; flex-wrap: wrap; gap: 32px; margin: 16px 0; }
        .tiles div { display: flex; flex-direction: column; }
        .tiles b { font-size: 28px; font-weight: 600; }
        .scroll { overflow-x: auto; }
        table { border-collapse: collapse; font-size: 14px; }
        th { text-transform: capitalize; }
        th, td { padding: 4px 16px 4px 0; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .key { text-align: left; }
        tbody tr:hover td { background: #f0efec; }
        [title] { cursor: help; }
        dl { margin-top: 32px; max-width: 640px; }
        dt { font-weight: 600; margin-top: 8px; }
        dd { margin: 0; }
    `,
    imports: [DecimalPipe, PercentPipe],
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
