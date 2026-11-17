import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { DataService } from '../shared/data.service';
import { EDIT_LOG_FIELDS, EditLogEntry, EditLogValue } from '../shared/edit-log';
import { withOffset } from '../shared/event-data';

interface ChangeRow {
  label: string;
  /** Empty when the field had nothing in it. */
  from: string;
  to: string;
  /** Too much text for one line, so it's shown folded away. */
  long: boolean;
  /** Part of a delete: `from` is what the item had, and there is no after. */
  removed: boolean;
}

interface Row {
  entry: EditLogEntry;
  who: string;
  whoNote: string;
  /** e.g. "Edited speaker". */
  what: string;
  /** The item's editor, while the item still exists. */
  link?: string[];
  label: string;
  changes: ChangeRow[];
}

const ACTIONS = { create: 'Created', update: 'Edited', delete: 'Deleted' };

/** Fields in the order the editors show them (the database returns them alphabetically). */
const FIELD_ORDER = Object.keys(EDIT_LOG_FIELDS);
const fieldOrder = (field: string) =>
  FIELD_ORDER.includes(field) ? FIELD_ORDER.indexOf(field) : FIELD_ORDER.length;

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Edit log entries as a table, newest first: when, who, and what changed. Short values are shown
 * in full; a long one (a bio, a description) is folded away with its before and after.
 */
@Component({
  selector: 'app-edit-log-entries',
  template: `
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th scope="col" class="text">When</th>
            <th scope="col" class="text">Who</th>
            @if (showItem()) {
              <th scope="col" class="text">What</th>
            }
            <th scope="col" class="text">Changes</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.entry.$key) {
            <tr>
              <td class="text when">
                <time [attr.datetime]="row.entry.at | date: 'yyyy-MM-ddTHH:mm:ssZZZZZ'">{{
                  row.entry.at | date: 'MMM d, h:mm a'
                }}</time>
              </td>
              <td class="text who">
                <div>{{ row.who }}</div>
                <div class="muted">{{ row.whoNote }}</div>
              </td>
              @if (showItem()) {
                <td class="text">
                  <div class="muted">{{ row.what }}</div>
                  @if (row.link) {
                    <a [routerLink]="row.link">{{ row.label }}</a>
                  } @else {
                    <div>{{ row.label }}</div>
                  }
                </td>
              }
              <td class="text changes">
                @if (!showItem()) {
                  <div class="muted">{{ row.what }}</div>
                }
                @for (change of row.changes; track change.label) {
                  @if (change.long) {
                    <details>
                      <summary>{{ change.label }}</summary>
                      @if (change.from) {
                        <div class="muted">Before</div>
                        <p class="value">{{ change.from }}</p>
                      }
                      @if (!change.removed) {
                        <div class="muted">{{ change.to ? 'After' : 'After: empty' }}</div>
                      }
                      @if (change.to) {
                        <p class="value">{{ change.to }}</p>
                      }
                    </details>
                  } @else if (change.removed) {
                    <div>
                      <span class="field">{{ change.label }}:</span>
                      <span>{{ change.from }}</span>
                    </div>
                  } @else {
                    <div>
                      <span class="field">{{ change.label }}:</span>
                      @if (change.from) {
                        <span class="from">{{ change.from }}</span>
                        <span aria-hidden="true"> → </span>
                        <span class="visually-hidden"> changed to </span>
                      }
                      @if (change.to) {
                        <span>{{ change.to }}</span>
                      } @else {
                        <span class="muted">empty</span>
                      }
                    </div>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    td {
      vertical-align: top;
    }
    /* More specific than the admin's wrapping text cells. */
    table.data td.when {
      white-space: nowrap;
    }
    .who {
      min-width: 200px;
    }
    .changes {
      min-width: 280px;
      overflow-wrap: anywhere;
    }
    .field {
      font-weight: 600;
      margin-right: 0.35em;
    }
    .from {
      color: var(--mat-sys-on-surface-variant);
      text-decoration: line-through;
    }
    summary {
      font-weight: 600;
      cursor: pointer;
    }
    .value {
      white-space: pre-wrap;
      margin: 0 0 8px;
    }
  `,
  imports: [DatePipe, RouterLink],
})
export class EditLogEntriesComponent {
  private ds = inject(DataService);

  readonly entries = input.required<EditLogEntry[]>();
  /** Whether to say which speaker or session each entry is about; off within one item's history. */
  readonly showItem = input(true);

  rows = computed<Row[]>(() =>
    [...this.entries()]
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .map((entry) => {
        const speakers = entry.path === 'speakers';
        // What the item is called now, for an entry logged before it had a name.
        const current = speakers
          ? this.ds.speaker(entry.key)?.name
          : this.ds.schedule().find((session) => session.$key === entry.key)?.title;
        const exists = speakers
          ? !!this.ds.speaker(entry.key)
          : this.ds.schedule().some((session) => session.$key === entry.key);
        return {
          entry,
          ...this.who(entry),
          what: `${ACTIONS[entry.action] ?? 'Changed'} ${speakers ? 'speaker' : 'session'}`,
          link: exists
            ? ['/admin', speakers ? 'speakers' : 'sessions', entry.key, 'edit']
            : undefined,
          label: entry.label || current || (speakers ? 'Unnamed speaker' : 'Untitled session'),
          changes: Object.entries(entry.changes ?? {})
            .sort(([a], [b]) => fieldOrder(a) - fieldOrder(b))
            .map(([field, change]) => {
              const from = this.display(field, change.from, change.to);
              const to = this.display(field, change.to, change.from);
              const label = EDIT_LOG_FIELDS[field] ?? field;
              const long = [from, to].some((text) => text.length > 80 || text.includes('\n'));
              return { label, from, to, long, removed: entry.action === 'delete' };
            }),
        };
      }),
  );

  private who(entry: EditLogEntry): Pick<Row, 'who' | 'whoNote'> {
    if (entry.via === 'admin') {
      return {
        who: entry.name || entry.email || 'An admin',
        whoNote: entry.name && entry.email ? `Admin · ${entry.email}` : 'Admin',
      };
    }
    const speaker =
      this.ds.speaker(entry.speaker)?.name ?? (entry.path === 'speakers' ? entry.label : undefined);
    // The start of the uid tells one browser from another, e.g. a speaker's from an organizer's.
    const browser = `browser ${entry.uid?.slice(0, 6) ?? 'unknown'}`;
    return {
      who: speaker ? `${speaker}'s edit link` : "A speaker's edit link",
      whoNote: entry.email ? `Signed in as ${entry.email}` : `Not signed in · ${browser}`,
    };
  }

  /** A logged value as text. `other` is the change's other side, which says what kind of field it is. */
  private display(field: string, value: EditLogValue | undefined, other?: EditLogValue): string {
    if (typeof (value ?? other) === 'boolean') return value ? 'Yes' : 'No';
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) {
      return value
        .map((item) => (field === 'speakers' && this.ds.speaker(item)?.name) || item)
        .join(', ');
    }
    if (field === 'startTime' && typeof value === 'string') {
      const start = new Date(withOffset(value)).getTime();
      return Number.isNaN(start) ? value : timeFormat.format(start);
    }
    return String(value);
  }
}
