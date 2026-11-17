import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { objectResource } from '../realtime-data/firebase';
import { DataService, Session, Speaker } from '../shared/data.service';
import { withOffset } from '../shared/event-data';
import { placeholderSessionTitle } from '../speaker-invite/speaker-session-edit';

/** Where this page lives; editors opened from it come back here. */
export const SESSION_PLANNING_PATH = '/admin/sessions';

type Filter = 'planning' | 'unpublished' | 'published' | 'all';

interface SpeakerRow {
  key: string;
  /** Undefined when the key doesn't match a speaker. */
  speaker?: Speaker;
}

interface Row {
  session: Session;
  speakers: SpeakerRow[];
  /** e.g. "1:40 PM", or null with no start time. */
  time: string | null;
  /** Start time in ms, for sorting. */
  start: number | null;
  where: string;
  note: string;
  todos: string[];
  /** Lowercased text the search box matches. */
  haystack: string;
}

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  minute: '2-digit',
});

/** What a session still needs before it's ready, in the order an organizer would do it. */
function todosFor(session: Session, speakers: SpeakerRow[]): string[] {
  const todos: string[] = [];
  const title = session.title?.trim();
  const found = speakers.filter((row) => row.speaker).map((row) => row.speaker);
  if (!title) {
    todos.push('Add a title');
  } else if (
    found.some((speaker) => speaker.name && title === placeholderSessionTitle(speaker.name))
  ) {
    todos.push('Speaker to write a title');
  }
  if (speakers.length && !session.description?.trim()) todos.push('Add a description');
  if (speakers.some((row) => !row.speaker)) todos.push('Fix missing speaker');
  const unpublished = found.filter((speaker) => !speaker.published).length;
  if (unpublished) todos.push(unpublished === 1 ? 'Publish speaker' : 'Publish speakers');
  if (!session.startTime) todos.push('Set a time');
  if (!session.room && session.track !== 'all') todos.push('Set a room');
  if (!session.published) todos.push('Publish session');
  return todos;
}

/**
 * Every session, with its speakers, time and room, and what each still needs before it's ready
 * to publish. Sessions are edited in the session editor, which comes back here.
 */
@Component({
  selector: 'app-session-planning',
  template: `
    <div class="page-header">
      <div>
        <h2>Session planning</h2>
        <p class="muted">Sessions in progress, their speakers, and what each still needs.</p>
      </div>
      <a mat-flat-button routerLink="/admin/sessions/new/edit" [state]="returnTo">New session</a>
    </div>

    <div class="tiles">
      <div class="tile">
        <span class="label">Sessions</span>
        <span class="value">{{ rows().length }}</span>
      </div>
      <div class="tile">
        <span class="label">In planning</span>
        <span class="value">{{ counts().planning }}</span>
        <span class="note">with something to do</span>
      </div>
      <div class="tile">
        <span class="label">Unpublished</span>
        <span class="value">{{ counts().unpublished }}</span>
      </div>
      <div class="tile">
        <span class="label">Published</span>
        <span class="value">{{ counts().published }}</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="segmented" role="group" aria-label="Show sessions">
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
        <span class="visually-hidden">Search sessions</span>
        <input
          type="search"
          placeholder="Search title, speaker, room, track or note"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </label>
    </div>

    @if (visible().length) {
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th scope="col" class="text">Session</th>
              <th scope="col" class="text">Speakers</th>
              <th scope="col" class="text">When and where</th>
              <th scope="col" class="text">Status</th>
              <th scope="col" class="text">To do</th>
              <th scope="col"><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.session.$key) {
              <tr>
                <td class="text session">
                  <a
                    class="title"
                    [routerLink]="['/admin/sessions', row.session.$key, 'edit']"
                    [state]="returnTo"
                    >{{ row.session.title || 'Untitled' }}</a
                  >
                  <div class="muted">
                    {{ row.session.track || 'No track' }} · {{ blocks(row.session) }}
                    {{ blocks(row.session) === 1 ? 'block' : 'blocks' }}
                    @if (row.session.updatedAt) {
                      · edited {{ row.session.updatedAt | date: 'MMM d' }}
                    }
                  </div>
                  @if (row.note) {
                    <div class="note">{{ row.note }}</div>
                  }
                </td>
                <td class="text">
                  @for (speaker of row.speakers; track speaker.key) {
                    <div class="speaker">
                      @if (speaker.speaker; as profile) {
                        <a
                          [routerLink]="['/admin/speakers', speaker.key, 'edit']"
                          [state]="returnTo"
                          >{{ profile.name || 'Unnamed speaker' }}</a
                        >
                        <span class="badge" [class.ok]="profile.published">{{
                          profile.published ? 'Published' : 'Unpublished'
                        }}</span>
                        @if (profile.company) {
                          <div class="muted">{{ profile.company }}</div>
                        }
                      } @else {
                        <span class="error">Missing speaker</span>
                      }
                    </div>
                  } @empty {
                    <span class="muted">None</span>
                  }
                </td>
                <td class="text">
                  <div [class.muted]="!row.time">{{ row.time ?? 'No time' }}</div>
                  <div class="muted">{{ row.where }}</div>
                </td>
                <td class="text">
                  <span class="badge" [class.ok]="row.session.published">{{
                    row.session.published ? 'Published' : 'Draft'
                  }}</span>
                </td>
                <td class="text">
                  @if (row.todos.length) {
                    <ul class="todos">
                      @for (todo of row.todos; track todo) {
                        <li>{{ todo }}</li>
                      }
                    </ul>
                  } @else {
                    <span class="ready">Ready</span>
                  }
                </td>
                <td>
                  <a
                    mat-button
                    [routerLink]="['/admin/sessions', row.session.$key, 'edit']"
                    [state]="returnTo"
                    [attr.aria-label]="'Edit ' + (row.session.title || 'untitled session')"
                    >Edit</a
                  >
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <p class="muted" role="status">
        {{ search().trim() ? 'No sessions match your search.' : 'No sessions here.' }}
      </p>
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: center;
      justify-content: space-between;
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
    .search input {
      width: min(100%, 340px);
      padding: 10px 14px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
    .search {
      flex: 1 1 240px;
      display: flex;
      justify-content: flex-end;
    }
    td {
      vertical-align: top;
    }
    .session {
      min-width: 220px;
    }
    .session .title {
      font-weight: 600;
    }
    .note {
      margin-top: 4px;
      font: var(--mat-sys-body-small);
      font-style: italic;
      color: var(--mat-sys-on-surface-variant);
    }
    .speaker + .speaker {
      margin-top: 8px;
    }
    .badge {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    td > .badge:first-child {
      margin-left: 0;
    }
    .badge.ok {
      background: color-mix(in srgb, var(--admin-success) 18%, transparent);
      color: var(--admin-success);
    }
    .todos {
      margin: 0;
      padding-left: 18px;
    }
    .ready {
      color: var(--admin-success);
      font-weight: 600;
    }
  `,
  imports: [DatePipe, RouterLink, MatButtonModule],
})
export class SessionPlanningComponent {
  private ds = inject(DataService);

  /** Admin-only internal notes, by session key. */
  private notes = objectResource<Record<string, string>>(() => this.ds.ref('adminNotes'), {
    initialValue: {},
  });

  readonly returnTo = { returnTo: SESSION_PLANNING_PATH };

  readonly filters: { value: Filter; label: string }[] = [
    { value: 'planning', label: 'In planning' },
    { value: 'unpublished', label: 'Unpublished' },
    { value: 'published', label: 'Published' },
    { value: 'all', label: 'All' },
  ];

  filter = signal<Filter>('planning');
  search = signal('');

  /** Older sessions saved their length as text ("2"). */
  blocks = (session: Session) => Number(session.blocks || 1);

  rows = computed<Row[]>(() => {
    const notes = this.notes() ?? {};
    return this.ds
      .schedule()
      .map((session) => {
        const speakers = Object.values(session.speakers ?? {})
          .filter(Boolean)
          .map((key) => ({ key, speaker: this.ds.speaker(key) }));
        const start = session.startTime ? new Date(withOffset(session.startTime)).getTime() : NaN;
        const valid = !Number.isNaN(start);
        const where = session.room || (session.track === 'all' ? 'All rooms' : 'No room');
        const note = notes[session.$key] ?? '';
        const haystack = [
          session.title,
          session.room,
          session.track,
          note,
          ...speakers.map((row) => row.speaker?.name),
        ]
          .filter(Boolean)
          .join('\n')
          .toLowerCase();
        return {
          session,
          speakers,
          time: valid ? timeFormat.format(start) : null,
          start: valid ? start : null,
          where,
          note,
          todos: todosFor(session, speakers),
          haystack,
        };
      })
      .sort(
        (a, b) =>
          Number(a.start !== null) - Number(b.start !== null) ||
          (a.start ?? 0) - (b.start ?? 0) ||
          (a.session.title ?? '').localeCompare(b.session.title ?? ''),
      );
  });

  counts = computed<Record<Filter, number>>(() => {
    const rows = this.rows();
    return {
      planning: rows.filter((row) => row.todos.length).length,
      unpublished: rows.filter((row) => !row.session.published).length,
      published: rows.filter((row) => row.session.published).length,
      all: rows.length,
    };
  });

  visible = computed(() => {
    const filter = this.filter();
    const terms = this.search().trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.rows().filter(
      (row) =>
        (filter === 'all' ||
          (filter === 'planning' && row.todos.length > 0) ||
          (filter === 'unpublished' && !row.session.published) ||
          (filter === 'published' && !!row.session.published)) &&
        terms.every((term) => row.haystack.includes(term)),
    );
  });
}
