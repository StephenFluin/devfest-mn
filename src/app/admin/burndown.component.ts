import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ref } from 'firebase/database';

import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';

/** One anonymous order, as stored in burndown/<year>/orders. Day and time are Central. */
interface BurndownOrder {
    day: string;
    time?: string;
    tickets: number;
    /** Total ticket price for the order, excluding Eventbrite fees and tax. */
    price: number;
}

interface BurndownYear {
    eventDate: string;
    updatedAt?: string;
    orders?: BurndownOrder[];
}

interface Series {
    year: string;
    color: string;
    /** Cumulative tickets sold, indexed by days before the event. */
    sold: number[];
    total: number;
    revenue: number;
}

const DAY = 24 * 60 * 60 * 1000;
const TIMEZONE = 'America/Chicago';
const WIDTH = 720;
const HEIGHT = 320;
const PAD = { top: 16, right: 56, bottom: 36, left: 48 };

/** Whole days from `day` until the event; both are YYYY-MM-DD. */
function daysBefore(day: string, eventDate: string) {
    return Math.round((Date.parse(eventDate) - Date.parse(day)) / DAY);
}

@Component({
    // The admin shell is light-only, so the chart uses the light palette only.
    template: `
        @if (auth.isAdmin()) {
        <h2>Ticket burndown</h2>
        <div class="toolbar">
            <button type="button" (click)="update()" [disabled]="updating()">
                {{ updating() ? 'Updating…' : 'Update from Eventbrite' }}
            </button>
            @if (current()?.updatedAt; as updatedAt) {
            <span class="muted">Last updated {{ updatedAt | date: 'MMM d, h:mm a' }}</span>
            } @if (message()) {
            <span class="muted">{{ message() }}</span>
            }
        </div>

        @if (currentSeries(); as now) {
        <div class="tiles">
            <div class="tile">
                <div class="label">{{ year }} tickets</div>
                <div class="value">{{ now.total | number }}</div>
            </div>
            <div class="tile">
                <div class="label">{{ year }} ticket revenue</div>
                <div class="value">{{ now.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</div>
            </div>
            <div class="tile">
                <div class="label">Days until event</div>
                <div class="value">{{ today() }}</div>
            </div>
            @if (lastYear(); as prev) {
            <div class="tile">
                <div class="label">{{ prev.year }} at this point</div>
                <div class="value">{{ soldAt(prev, today()) | number }}</div>
                <div class="muted">of {{ prev.total | number }} total</div>
            </div>
            }
        </div>
        }

        @if (series().length) {
        <div class="legend">
            @for (s of series(); track s.year) {
            <span><i [style.background]="s.color"></i>{{ s.year }}</span>
            }
        </div>
        <div class="chart">
            <svg
                [attr.viewBox]="'0 0 ' + width + ' ' + height"
                role="img"
                aria-label="Cumulative tickets sold by days before the event, per year"
                (pointermove)="hover($event)"
                (pointerleave)="hoverDay.set(null)"
            >
                @for (tick of yTicks(); track tick) {
                <line class="grid" [attr.x1]="pad.left" [attr.x2]="width - pad.right" [attr.y1]="y(tick)" [attr.y2]="y(tick)" />
                <text class="axis" [attr.x]="pad.left - 8" [attr.y]="y(tick) + 4" text-anchor="end">{{ tick | number }}</text>
                } @for (tick of xTicks(); track tick) {
                <text class="axis" [attr.x]="x(tick)" [attr.y]="height - pad.bottom + 18" text-anchor="middle">{{ tick }}</text>
                }
                <text class="axis" [attr.x]="(pad.left + width - pad.right) / 2" [attr.y]="height - 4" text-anchor="middle">
                    Days before event
                </text>
                @for (s of series(); track s.year) {
                <polyline class="line" [attr.points]="points(s)" [attr.stroke]="s.color" [class.focus]="s.year === year" />
                } @if (currentSeries(); as now) {
                <circle class="end" [attr.cx]="x(today())" [attr.cy]="y(now.total)" r="5" [attr.fill]="now.color" />
                <text class="end-label" [attr.x]="x(today()) + 10" [attr.y]="y(now.total) + 4">{{ now.total | number }}</text>
                } @if (hoverDay() !== null) {
                <line class="crosshair" [attr.x1]="x(hoverDay()!)" [attr.x2]="x(hoverDay()!)" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" />
                }
            </svg>
            @if (hoverDay() !== null) {
            <div class="tooltip" [style.left.%]="(x(hoverDay()!) / width) * 100">
                <strong>{{ hoverDay() }} days out</strong>
                @for (s of series(); track s.year) { @if (s.sold.length > hoverDay()!) {
                <div><i [style.background]="s.color"></i>{{ s.year }}: {{ s.sold[hoverDay()!] | number }}</div>
                } }
            </div>
            }
        </div>

        <table>
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Sold {{ today() }} days out</th>
                    <th>Final</th>
                    <th>Ticket revenue</th>
                    <th>Avg price</th>
                </tr>
            </thead>
            <tbody>
                @for (s of series(); track s.year) {
                <tr>
                    <td>{{ s.year }}</td>
                    <td>{{ soldAt(s, today()) | number }}</td>
                    <td>{{ s.year === year ? '—' : (s.total | number) }}</td>
                    <td>{{ s.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                    <td>{{ s.revenue / s.total | currency: 'USD' }}</td>
                </tr>
                }
            </tbody>
        </table>
        } @else {
        <p class="muted">No orders yet. Use "Update from Eventbrite" to load them.</p>
        } }
    `,
    styles: `
        :host {
            --series-current: #2a78d6;
            --series-previous: #eb6834;
            --series-context: #b9b7b0;
            --grid: #e6e5e1;
            display: block;
            max-width: 760px;
        }
        .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin: 12px 0; }
        .muted, .axis { color: #52514e; fill: #52514e; font-size: 12px; }
        .tiles { display: flex; flex-wrap: wrap; gap: 24px; margin: 16px 0; }
        .tile .label { font-size: 13px; color: #52514e; }
        .tile .value { font-size: 28px; font-weight: 600; }
        .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; }
        i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
        .chart { position: relative; }
        svg { width: 100%; height: auto; display: block; touch-action: none; }
        .grid { stroke: var(--grid); stroke-width: 1; }
        .line { fill: none; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
        .line.focus { stroke-width: 2.5; }
        .end { stroke: #fff; stroke-width: 2; }
        .end-label { font-size: 13px; font-weight: 600; fill: #0b0b0b; }
        .crosshair { stroke: #8a8984; stroke-width: 1; }
        .tooltip {
            position: absolute; top: 8px; transform: translateX(-50%); pointer-events: none;
            background: #fff; border: 1px solid var(--grid); border-radius: 6px;
            padding: 6px 10px; font-size: 12px; white-space: nowrap; box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
        }
        table { border-collapse: collapse; margin-top: 16px; font-size: 14px; }
        th, td { padding: 4px 16px 4px 0; text-align: right; }
        th:first-child, td:first-child { text-align: left; }
    `,
    imports: [CurrencyPipe, DatePipe, DecimalPipe],
})
export class BurndownComponent {
    auth = inject(AuthService);
    db = inject(DATABASE);

    readonly year = environment.year;
    readonly width = WIDTH;
    readonly height = HEIGHT;
    readonly pad = PAD;

    updating = signal(false);
    message = signal('');
    hoverDay = signal<number | null>(null);

    data = objectResource<Record<string, BurndownYear>>(
        () => (this.auth.isAdmin() ? ref(this.db, 'burndown') : undefined),
        { initialValue: {} }
    );
    current = computed(() => this.data()[this.year]);

    /** Days until this year's event, which is where the current line stops. */
    today = computed(() =>
        Math.max(
            0,
            daysBefore(
                new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE }),
                environment.eventDate
            )
        )
    );

    series = computed<Series[]>(() =>
        Object.entries(this.data())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([year, { eventDate, orders = {} }], i) => {
                const perDay: number[] = [];
                let revenue = 0;
                for (const order of Object.values(orders)) {
                    const day = Math.max(0, daysBefore(order.day, eventDate));
                    perDay[day] = (perDay[day] ?? 0) + order.tickets;
                    revenue += order.price;
                }
                // Walk from the first sale toward the event, accumulating.
                const end = year === this.year ? this.today() : 0;
                const sold: number[] = [];
                let total = 0;
                for (let day = perDay.length - 1; day >= end; day--) {
                    total += perDay[day] ?? 0;
                    sold[day] = total;
                }
                const color =
                    year === this.year
                        ? 'var(--series-current)'
                        : i === 1
                          ? 'var(--series-previous)'
                          : 'var(--series-context)';
                return { year, color, sold, total, revenue };
            })
            .filter((s) => s.total > 0)
    );
    currentSeries = computed(() => this.series().find((s) => s.year === this.year));
    lastYear = computed(() => this.series().find((s) => s.year !== this.year));

    maxDays = computed(() => {
        const longest = Math.max(30, ...this.series().map((s) => s.sold.length - 1));
        return Math.ceil(longest / 10) * 10;
    });
    maxTickets = computed(() => {
        const top = Math.max(10, ...this.series().map((s) => s.total));
        const step = this.tickStep(top);
        return Math.ceil(top / step) * step;
    });
    yTicks = computed(() => {
        const step = this.tickStep(this.maxTickets());
        return Array.from({ length: this.maxTickets() / step + 1 }, (_, i) => i * step);
    });
    xTicks = computed(() => {
        const step = this.maxDays() > 100 ? 20 : 10;
        return Array.from({ length: Math.floor(this.maxDays() / step) + 1 }, (_, i) => i * step);
    });

    /** Days run right-to-left toward the event, so the x axis counts down to 0. */
    x(day: number) {
        return PAD.left + (1 - day / this.maxDays()) * (WIDTH - PAD.left - PAD.right);
    }
    y(tickets: number) {
        return HEIGHT - PAD.bottom - (tickets / this.maxTickets()) * (HEIGHT - PAD.top - PAD.bottom);
    }
    points(s: Series) {
        const points: string[] = [];
        for (let day = s.sold.length - 1; day >= 0; day--) {
            if (s.sold[day] !== undefined) points.push(`${this.x(day)},${this.y(s.sold[day])}`);
        }
        return points.join(' ');
    }
    /** Tickets sold `day` days out; 0 before the first sale. */
    soldAt(s: Series, day: number) {
        for (let d = day; d < s.sold.length; d++) {
            if (s.sold[d] !== undefined) return s.sold[d];
        }
        return 0;
    }
    private tickStep(max: number) {
        return [10, 25, 50, 100, 250, 500].find((step) => max / step <= 6) ?? 1000;
    }

    hover(event: PointerEvent) {
        const svg = event.currentTarget as SVGSVGElement;
        const box = svg.getBoundingClientRect();
        const px = ((event.clientX - box.left) / box.width) * WIDTH;
        const fraction = (px - PAD.left) / (WIDTH - PAD.left - PAD.right);
        const day = Math.round((1 - fraction) * this.maxDays());
        this.hoverDay.set(day >= 0 && day <= this.maxDays() ? day : null);
    }

    async update() {
        this.updating.set(true);
        this.message.set('');
        try {
            const idToken = await this.auth.auth?.currentUser?.getIdToken();
            const response = await fetch('/api/admin/burndown/update', {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}` },
            });
            const result = await response.json();
            this.message.set(
                response.ok ? `Loaded ${result.orders} orders.` : (result.error ?? 'Update failed')
            );
        } catch {
            this.message.set('Update failed');
        } finally {
            this.updating.set(false);
        }
    }
}
