import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../../environments/environment';
import { DataService, Session } from '../shared/data.service';
import { SESSION_LIMITS } from './speaker-session-edit';

/**
 * An invited speaker's sessions on their edit page. They can change each session's title and
 * description; when and where it is, its track and who's presenting are shown but stay with the
 * organizers. Saves go through the server, which checks the invite (see /api/speaker-edit in
 * server.ts).
 */
@Component({
  selector: 'app-speaker-sessions',
  template: `
    @for (session of sessions(); track session.$key) {
      <form class="session" (ngSubmit)="save(session)">
        <label
          >Session title
          <input
            [name]="'title-' + session.$key"
            [(ngModel)]="session.title"
            required
            [maxlength]="limits.title"
        /></label>
        <label
          >Description (Markdown)
          <textarea
            [name]="'description-' + session.$key"
            [(ngModel)]="session.description"
            rows="8"
            [maxlength]="limits.description"
          ></textarea>
        </label>
        <dl>
          @if (session.track && session.track !== 'all') {
            <dt>Track</dt>
            <dd>{{ session.track }}</dd>
          }
          <dt>When and where</dt>
          <dd>
            @if (showSchedule && session.startTime) {
              {{ ds.customDateFormatter(session.startTime) }}, {{ eventDate
              }}{{ session.room ? ' in ' + session.room : '' }}
            } @else {
              We'll let you know once the schedule is published.
            }
          </dd>
          <dt>On the site</dt>
          <dd>
            {{ session.published ? 'Yes' : "Not yet. We'll publish it once we've reviewed it." }}
          </dd>
          @if (coSpeakers(session); as others) {
            <dt>Presenting with</dt>
            <dd>{{ others }}</dd>
          }
        </dl>
        <p class="muted">
          To change the time, room or who's presenting, email
          <a href="mailto:info@devfest.mn">info&#64;devfest.mn</a>.
        </p>
        <button type="submit" [disabled]="saving() === session.$key">Save session</button>
        @if (status()[session.$key]; as status) {
          <span role="status">{{ status }}</span>
        }
      </form>
    } @empty {
      <p>
        Once we've added your session to the schedule, you can edit its title and description here.
      </p>
    }
  `,
  styles: `
    .session {
      padding: 16px 0;
    }
    .session + .session {
      border-top: 1px solid var(--color-border-soft);
    }
    label {
      display: block;
      margin: 16px 0;
    }
    input,
    textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      padding: 6px;
    }
    dt {
      font-weight: bold;
    }
    dd {
      margin: 0 0 8px;
    }
    .muted {
      color: var(--color-text-muted);
    }
  `,
  imports: [FormsModule],
})
export class SpeakerSessionsComponent {
  ds = inject(DataService);
  readonly speakerKey = input.required<string>();
  readonly token = input.required<string>();

  readonly limits = SESSION_LIMITS;
  readonly showSchedule = environment.showSchedule;
  readonly eventDate = environment.eventDateDisplay;

  saving = signal<string | undefined>(undefined);
  status = signal<Record<string, string>>({});

  /** Copies, so form edits don't leak into the shared live data before saving. */
  sessions = computed<Session[]>(() =>
    this.ds
      .sessionsFor(this.speakerKey(), { unpublished: true })
      .map((session) => ({ ...session })),
  );

  /** The other speakers' names, if the session has any. */
  coSpeakers(session: Session) {
    return Object.values(session.speakers ?? {})
      .filter((key) => key !== this.speakerKey())
      .map((key) => this.ds.speaker(key)?.name)
      .filter(Boolean)
      .join(', ');
  }

  async save(session: Session) {
    this.saving.set(session.$key);
    this.setStatus(session, '');
    try {
      const response = await fetch(
        `/api/speaker-edit/${this.token()}/sessions/${encodeURIComponent(session.$key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: session.title, description: session.description }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? `Saving failed (${response.status})`);
      }
      this.setStatus(session, 'Saved. Thanks!');
    } catch (err) {
      console.error('Unable to save session', err);
      this.setStatus(session, `Sorry, saving failed: ${err.message}`);
    } finally {
      this.saving.set(undefined);
    }
  }

  private setStatus(session: Session, message: string) {
    this.status.update((status) => ({ ...status, [session.$key]: message }));
  }
}
