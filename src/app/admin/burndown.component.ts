import { afterRenderEffect, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ref } from 'firebase/database';
import { MatButtonModule } from '@angular/material/button';

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
/**
 * One color per year, newest first, in the validated categorical order. Each has a lighter version
 * for dark mode, picked by light-dark() from the page's color scheme.
 */
const SERIES_COLORS = [
    ['#2a78d6', '#6aa6f0'],
    ['#eb6834', '#f28b5e'],
    ['#1baf7a', '#3fcf98'],
    ['#eda100', '#f5bd3d'],
    ['#e87ba4', '#f09cbd'],
    ['#008300', '#4cc24c'],
    ['#4a3aa7', '#9488e8'],
    ['#e34948', '#f07574'],
].map(([light, dark]) => `light-dark(${light}, ${dark})`);

/** Whole days from `day` until the event; both are YYYY-MM-DD. */
function daysBefore(day: string, eventDate: string) {
    return Math.round((Date.parse(eventDate) - Date.parse(day)) / DAY);
}

@Component({
    template: `
        @if (auth.isAdmin()) {
        <div class="page-header">
            <div>
                <h2>Ticket burndown</h2>
                <p class="muted">
                    @if (current()?.updatedAt; as updatedAt) {
                    Last updated {{ updatedAt | date: 'MMM d, h:mm a' }}
                    } @else { Not loaded yet }
                </p>
            </div>
            <div class="actions">
                @if (message()) {
                <span class="status" role="status">{{ message() }}</span>
                }
                <button mat-flat-button type="button" (click)="update()" [disabled]="updating()">
                    {{ updating() ? 'Updating…' : 'Update from Eventbrite' }}
                </button>
            </div>
        </div>

        @if (currentSeries(); as now) {
        <div class="tiles">
            <div class="tile">
                <span class="label">{{ year }} tickets</span>
                <span class="value">{{ now.total | number }}</span>
            </div>
            <div class="tile">
                <span class="label">{{ year }} ticket revenue</span>
                <span class="value">{{ now.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</span>
            </div>
            <div class="tile">
                <span class="label">Days until event</span>
                <span class="value">{{ today() }}</span>
            </div>
            @if (lastYear(); as prev) {
            <div class="tile">
                <span class="label">{{ prev.year }} at this point</span>
                <span class="value">{{ soldAt(prev, today()) | number }}</span>
                <span class="note">of {{ prev.total | number }} total</span>
            </div>
            }
        </div>
        }

        @if (series().length) {
        <section class="card">
        <div class="legend" role="group" aria-label="Years shown">
            @for (s of series(); track s.year) {
            <button
                type="button"
                [class.off]="hidden().has(s.year)"
                [attr.aria-pressed]="!hidden().has(s.year)"
                (click)="toggle(s.year)"
            >
                <i [style.background]="s.color"></i>{{ s.year }}
            </button>
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
                <text class="axis" [attr.x]="x(tick)" [attr.y]="height - pad.bottom + 18" text-anchor="middle">{{ tick ? -tick : 0 }}</text>
                }
                <text class="axis" [attr.x]="(pad.left + width - pad.right) / 2" [attr.y]="height - 4" text-anchor="middle">
                    Days before event
                </text>
                @for (s of visible(); track s.year) {
                <polyline class="line" [attr.points]="points(s)" [style.stroke]="s.color" [class.focus]="s.year === year" />
                } @if (currentSeries(); as now) {
                <circle class="end" [attr.cx]="x(today())" [attr.cy]="y(now.total)" r="5" [style.fill]="now.color" />
                <text class="end-label" [attr.x]="x(today()) + 10" [attr.y]="y(now.total) + 4">{{ now.total | number }}</text>
                } @if (hoverDay() !== null) {
                <line class="crosshair" [attr.x1]="x(hoverDay()!)" [attr.x2]="x(hoverDay()!)" [attr.y1]="pad.top" [attr.y2]="height - pad.bottom" />
                }
            </svg>
            @if (hoverDay() !== null) {
            <!-- Sits low and beside the crosshair: cumulative lines climb to the top right. -->
            <div
                class="tooltip"
                [class.flip]="x(hoverDay()!) > width / 2"
                [style.left.%]="(x(hoverDay()!) / width) * 100"
                [style.bottom.%]="(pad.bottom / height) * 100"
            >
                <strong>Day {{ hoverDay() ? -hoverDay()! : 0 }}</strong>
                @for (s of visible(); track s.year) { @if (s.sold[hoverDay()!] !== undefined) {
                <div><i [style.background]="s.color"></i>{{ s.year }}: {{ s.sold[hoverDay()!] | number }}</div>
                } }
            </div>
            }
        </div>
        </section>

        <div class="table-wrap">
        <table class="data">
            <thead>
                <tr>
                    <th scope="col" class="text">Year</th>
                    <th scope="col">Sold {{ today() }} days out</th>
                    <th scope="col">Final</th>
                    <th scope="col">Ticket revenue</th>
                    <th scope="col">Avg price</th>
                </tr>
            </thead>
            <tbody>
                @for (s of visible(); track s.year) {
                <tr>
                    <td class="text"><i [style.background]="s.color"></i>{{ s.year }}</td>
                    <td>{{ soldAt(s, today()) | number }}</td>
                    <td>{{ s.year === year ? '—' : (s.total | number) }}</td>
                    <td>{{ s.revenue | currency: 'USD' : 'symbol' : '1.0-0' }}</td>
                    <td>{{ s.revenue / s.total | currency: 'USD' }}</td>
                </tr>
                }
            </tbody>
        </table>
        </div>

        <h3 class="by-day-heading">Cumulative tickets by day</h3>
        <div class="by-day table-wrap" #byDay tabindex="0" aria-label="Cumulative tickets by day, scrollable">
            <table class="data">
                <thead>
                    <tr>
                        <th scope="col" class="text">Day</th>
                        @for (s of visible(); track s.year) {
                        <th scope="col">{{ s.year }}</th>
                        }
                    </tr>
                </thead>
                <tbody>
                    @for (day of days(); track day) {
                    <tr [class.today]="day === today()" [attr.aria-current]="day === today() ? 'date' : null">
                        <td class="text">{{ day ? -day : 0 }}</td>
                        @for (s of visible(); track s.year) {
                        <td>{{ s.sold[day] | number }}</td>
                        }
                    </tr>
                    }
                </tbody>
            </table>
        </div>
        } @else {
        <p class="muted">No orders yet. Use "Update from Eventbrite" to load them.</p>
        } }
    `,
    styles: `
        :host {
            --grid: var(--mat-sys-outline-variant);
            display: block;
        }
        .axis { fill: var(--mat-sys-on-surface-variant); font-size: 12px; }
        .legend { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
        .legend button {
            padding: 6px 12px; border: 1px solid var(--mat-sys-outline-variant); background: none;
            color: var(--mat-sys-on-surface); cursor: pointer; font: var(--mat-sys-label-large);
        }
        .legend button:hover { background: var(--mat-sys-surface-container-high); }
        .legend button.off { color: var(--mat-sys-on-surface-variant); text-decoration: line-through; }
        .legend button.off i { opacity: 0.35; }
        i { display: inline-block; width: 12px; height: 4px; border-radius: 2px; margin-right: 8px; vertical-align: middle; }
        .chart { position: relative; }
        svg { width: 100%; height: auto; display: block; touch-action: none; }
        .grid { stroke: var(--grid); stroke-width: 1; }
        .line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
        .line.focus { stroke-width: 3.5; }
        .end { stroke: var(--mat-sys-surface-container-low); stroke-width: 2; }
        .end-label { font-size: 13px; font-weight: 600; fill: var(--mat-sys-on-surface); }
        .crosshair { stroke: var(--mat-sys-outline); stroke-width: 1; }
        .tooltip {
            position: absolute; transform: translate(12px, -8px); pointer-events: none;
            background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface);
            border-radius: 8px; padding: 8px 12px; font: var(--mat-sys-body-small);
            white-space: nowrap; box-shadow: var(--admin-shadow);
        }
        .tooltip.flip { transform: translate(calc(-100% - 12px), -8px); }
        .by-day-heading { margin-top: 32px; }
        .by-day { max-height: 480px; overflow-y: auto; }
        .by-day tr.today td { background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); font-weight: 600; }
    `,
    imports: [CurrencyPipe, DatePipe, DecimalPipe, MatButtonModule],
})
export class BurndownComponent {
    auth = inject(AuthService);
    db = inject(DATABASE);

    readonly year = environment.year;
    readonly width = WIDTH;
    readonly height = HEIGHT;
    readonly pad = PAD;

    byDay = viewChild<ElementRef<HTMLElement>>('byDay');
    private scrolledToToday = false;

    constructor() {
        // Once the by-day table first renders, scroll it (not the page) so today's row is centered.
        afterRenderEffect(() => {
            const table = this.byDay()?.nativeElement;
            this.days();
            const row = table?.querySelector<HTMLElement>('tr.today');
            if (!table || !row || this.scrolledToToday) return;
            const offset = row.getBoundingClientRect().top - table.getBoundingClientRect().top;
            table.scrollTop += offset - (table.clientHeight - row.offsetHeight) / 2;
            this.scrolledToToday = true;
        });
    }

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
                const color = SERIES_COLORS[Math.min(i, SERIES_COLORS.length - 1)];
                return { year, color, sold, total, revenue };
            })
            .filter((s) => s.total > 0)
    );
    /** Years switched off in the legend; the oldest start hidden to keep the chart readable. */
    hidden = signal(new Set(['2017', '2018', '2019']));
    visible = computed(() => this.series().filter((s) => !this.hidden().has(s.year)));
    toggle(year: string) {
        this.hidden.update((hidden) => {
            const next = new Set(hidden);
            if (!next.delete(year)) next.add(year);
            return next;
        });
    }

    currentSeries = computed(() => this.series().find((s) => s.year === this.year));
    lastYear = computed(() => this.series().find((s) => s.year !== this.year));

    /** The left edge: the earliest first day of sales across all years. */
    maxDays = computed(() => Math.max(1, ...this.visible().map((s) => s.sold.length - 1)));
    /** Table rows, left to right like the chart: first day of sales down to event day. */
    days = computed(() => Array.from({ length: this.maxDays() + 1 }, (_, i) => this.maxDays() - i));
    maxTickets = computed(() => {
        const top = Math.max(10, ...this.visible().map((s) => s.total));
        const step = this.tickStep(top);
        return Math.ceil(top / step) * step;
    });
    yTicks = computed(() => {
        const step = this.tickStep(this.maxTickets());
        return Array.from({ length: this.maxTickets() / step + 1 }, (_, i) => i * step);
    });
    xTicks = computed(() => {
        const step = this.maxDays() > 100 ? 20 : 10;
        const ticks = Array.from({ length: Math.floor(this.maxDays() / step) + 1 }, (_, i) => i * step);
        // Label the first day of sales too, unless it would crowd the last round tick.
        if (this.maxDays() - ticks[ticks.length - 1] > step / 2) ticks.push(this.maxDays());
        return ticks;
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
