import { Component, computed, inject, signal } from '@angular/core';
import { limitToLast, query } from 'firebase/database';

import { listResource } from '../realtime-data/firebase';
import { DataService } from '../shared/data.service';
import { EDIT_LOG_FIELDS, EditLogEntry } from '../shared/edit-log';
import { EditLogEntriesComponent } from './edit-log-entries.component';

type Filter = 'all' | 'speakers' | 'schedule' | 'invite';

/** How many of the latest entries the page loads. */
const LIMIT = 500;

/**
 * Who changed which speaker or session, and when: every change made in the admin or from a
 * speaker's edit link since the edit log began (see shared/edit-log.ts).
 */
@Component({
  selector: 'app-edit-log',
  template: `
    <div class="page-header">
      <div>
        <h2>Edit log</h2>
        <p class="muted">
          Changes to speakers and sessions, newest first, with who made each one: an admin, or
          someone using a speaker's edit link.
        </p>
      </div>
    </div>

    @if (entries.failed()) {
      <p class="notice warn" role="alert">
        Couldn't load the edit log. If it was only just added, deploy the database rules (see the
        README).
      </p>
    } @else if (!entries.loaded()) {
      <p class="muted" role="status">Loading the edit log…</p>
    } @else {
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Show changes">
          @for (option of filters; track option.value) {
            <button
              type="button"
              [class.selected]="filter() === option.value"
              [attr.aria-pressed]="filter() === option.value"
              (click)="filter.set(option.value)"
            >
              {{ option.label }} <span class="count">{{ counts()[option.value] }}</span>
            </button>
          }
        </div>
        <label class="search">
          <span class="visually-hidden">Search the edit log</span>
          <input
            type="search"
            placeholder="Search speaker, session, person or field"
            [value]="search()"
            (input)="search.set($any($event.target).value)"
          />
        </label>
      </div>

      @if (visible().length) {
        <app-edit-log-entries [entries]="visible()" />
      } @else {
        <p class="muted" role="status">
          {{
            entries().length
              ? 'No changes match.'
              : 'No changes logged yet. Changes made from now on appear here.'
          }}
        </p>
      }
      @if (entries().length >= limit) {
        <p class="muted older">Showing the latest {{ limit }} changes.</p>
      }
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: center;
      margin-bottom: 16px;
    }
    .segmented {
      display: inline-flex;
      flex-wrap: wrap;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 999px;
      overflow: hidden;
    }
    .segmented button {
      padding: 8px 16px;
      border: 0;
      border-left: 1px solid var(--mat-sys-outline);
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .segmented button:first-child {
      border-left: 0;
    }
    .segmented button:hover {
      background: var(--mat-sys-surface-container-high);
    }
    .segmented button.selected {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .segmented .count {
      margin-left: 4px;
      color: var(--mat-sys-on-surface-variant);
      font-variant-numeric: tabular-nums;
    }
    .search {
      flex: 1 1 240px;
      margin-left: auto;
      display: flex;
      justify-content: flex-end;
    }
    .search input {
      width: min(100%, 340px);
      padding: 10px 14px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    .older {
      margin-top: 16px;
    }
  `,
  imports: [EditLogEntriesComponent],
})
export class EditLogComponent {
  private ds = inject(DataService);

  readonly limit = LIMIT;

  /** Keys are in the order they were written, so the last ones are the latest. */
  entries = listResource<EditLogEntry>(
    () => query(this.ds.ref('editLog'), limitToLast(LIMIT)),
    '$key',
  );

  readonly filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'speakers', label: 'Speakers' },
    { value: 'schedule', label: 'Sessions' },
    { value: 'invite', label: 'By speakers' },
  ];

  filter = signal<Filter>('all');
  search = signal('');

  private matches(entry: EditLogEntry, filter: Filter) {
    return filter === 'all' || (filter === 'invite' ? entry.via : entry.path) === filter;
  }

  counts = computed<Record<Filter, number>>(() => {
    const count = (filter: Filter) =>
      this.entries().filter((entry) => this.matches(entry, filter)).length;
    return {
      all: count('all'),
      speakers: count('speakers'),
      schedule: count('schedule'),
      invite: count('invite'),
    };
  });

  visible = computed(() => {
    const filter = this.filter();
    const terms = this.search().trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.entries().filter((entry) => {
      if (!this.matches(entry, filter)) return false;
      if (!terms.length) return true;
      const haystack = [
        entry.label,
        entry.name,
        entry.email,
        this.ds.speaker(entry.speaker)?.name,
        ...Object.keys(entry.changes ?? {}).map((field) => EDIT_LOG_FIELDS[field] ?? field),
      ]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  });
}
