import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../../environments/environment';
import { DataService, Session } from '../shared/data.service';
import { TALK_LIMITS } from './talk-edit';

/**
 * An invited speaker's talks on their edit page. They can change each talk's title and
 * description; when and where it is, its track and who's presenting are shown but stay with the
 * organizers. Saves go through the server, which checks the invite (see /api/speaker-edit in
 * server.ts).
 */
@Component({
  selector: 'app-speaker-talks',
  template: `
    @for (talk of talks(); track talk.$key) {
      <form class="talk" (ngSubmit)="save(talk)">
        <label
          >Talk title
          <input
            [name]="'title-' + talk.$key"
            [(ngModel)]="talk.title"
            required
            [maxlength]="limits.title"
        /></label>
        <label
          >Description (Markdown)
          <textarea
            [name]="'description-' + talk.$key"
            [(ngModel)]="talk.description"
            rows="8"
            [maxlength]="limits.description"
          ></textarea>
        </label>
        <dl>
          @if (talk.track && talk.track !== 'all') {
            <dt>Track</dt>
            <dd>{{ talk.track }}</dd>
          }
          <dt>When and where</dt>
          <dd>
            @if (showSchedule && talk.startTime) {
              {{ ds.customDateFormatter(talk.startTime) }}, {{ eventDate
              }}{{ talk.room ? ' in ' + talk.room : '' }}
            } @else {
              We'll let you know once the schedule is published.
            }
          </dd>
          <dt>On the site</dt>
          <dd>
            {{ talk.published ? 'Yes' : "Not yet. We'll publish it once we've reviewed it." }}
          </dd>
          @if (coSpeakers(talk); as others) {
            <dt>Presenting with</dt>
            <dd>{{ others }}</dd>
          }
        </dl>
        <p class="muted">
          To change the time, room or who's presenting, email
          <a href="mailto:info@devfest.mn">info&#64;devfest.mn</a>.
        </p>
        <button type="submit" [disabled]="saving() === talk.$key">Save talk</button>
        @if (status()[talk.$key]; as status) {
          <span role="status">{{ status }}</span>
        }
      </form>
    } @empty {
      <p>
        Once we've added your talk to the schedule, you can edit its title and description here.
      </p>
    }
  `,
  styles: `
    .talk {
      padding: 16px 0;
    }
    .talk + .talk {
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
export class SpeakerTalksComponent {
  ds = inject(DataService);
  readonly speakerKey = input.required<string>();
  readonly token = input.required<string>();

  readonly limits = TALK_LIMITS;
  readonly showSchedule = environment.showSchedule;
  readonly eventDate = environment.eventDateDisplay;

  saving = signal<string | undefined>(undefined);
  status = signal<Record<string, string>>({});

  /** Copies, so form edits don't leak into the shared live data before saving. */
  talks = computed<Session[]>(() =>
    this.ds
      .sessionsFor(this.speakerKey(), { unpublished: true })
      .map((session) => ({ ...session })),
  );

  /** The other speakers' names, if the talk has any. */
  coSpeakers(talk: Session) {
    return Object.values(talk.speakers ?? {})
      .filter((key) => key !== this.speakerKey())
      .map((key) => this.ds.speaker(key)?.name)
      .filter(Boolean)
      .join(', ');
  }

  async save(talk: Session) {
    this.saving.set(talk.$key);
    this.setStatus(talk, '');
    try {
      const response = await fetch(
        `/api/speaker-edit/${this.token()}/sessions/${encodeURIComponent(talk.$key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: talk.title, description: talk.description }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error ?? `Saving failed (${response.status})`);
      }
      this.setStatus(talk, 'Saved. Thanks!');
    } catch (err) {
      console.error('Unable to save talk', err);
      this.setStatus(talk, `Sorry, saving failed: ${err.message}`);
    } finally {
      this.saving.set(undefined);
    }
  }

  private setStatus(talk: Session, message: string) {
    this.status.update((status) => ({ ...status, [talk.$key]: message }));
  }
}
