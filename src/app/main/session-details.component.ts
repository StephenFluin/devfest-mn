import { Component, computed, inject, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { DataService, Session } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { UserFeedbackComponent } from './user-feedback.component';
import { SpeakerContainerComponent } from './speaker-container.component';
import { KeyValuePipe } from '@angular/common';
import { AgendaService } from '../shared/agenda.service';
import { environment } from '../../environments/environment';
import { calendarEvent, googleCalendarUrl, icsPath } from '../shared/calendar';
import { sessionEnd } from '../shared/event-data';

@Component({
  selector: 'app-session-details',
  templateUrl: 'session-details.component.html',
  styles: `
    .session-page {
      max-width: 1080px;
      margin: 0 auto;
      text-align: left;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--color-text-muted);
      font-family: Montserrat, sans-serif;
      font-size: 14px;
      text-decoration: none;
    }
    .back svg {
      width: 18px;
      height: 18px;
      fill: currentColor;
    }
    .intro {
      margin: 16px 0 32px;
    }
    .chip.session {
      display: inline-block;
      padding: 2px 12px;
      border-radius: 999px;
      font-family: Montserrat, sans-serif;
      font-size: 13px;
      font-weight: 600;
    }
    h1 {
      font-family: Montserrat, sans-serif;
      font-size: clamp(28px, 4vw, 40px);
      line-height: 1.2;
      margin: 12px 0 8px;
      text-align: left;
    }
    .edit img {
      width: 20px;
      vertical-align: middle;
    }
    .when {
      margin: 0;
      color: var(--color-text-muted);
      font-size: 18px;
    }

    /*
     * The description gets the wide column; logistics, speakers and rating sit beside it. On a
     * phone they stack, with when and where first.
     */
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      grid-template-areas:
        'content logistics'
        'content speakers'
        'content feedback';
      grid-template-rows: auto auto 1fr;
      gap: 24px 48px;
      align-items: start;
    }
    /* Undo the site-wide centered, padded section. */
    .layout > section {
      text-align: left;
      padding: 0;
    }
    .layout > section.panel {
      padding: 20px;
    }
    .content {
      grid-area: content;
    }
    .logistics {
      grid-area: logistics;
    }
    .speakers {
      grid-area: speakers;
      display: grid;
      gap: 12px;
    }
    .feedback {
      grid-area: feedback;
    }
    @media (max-width: 800px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: 'logistics' 'content' 'speakers' 'feedback';
        grid-template-rows: auto;
      }
      /* The When and where card follows right away. */
      .intro .when {
        display: none;
      }
    }

    .description {
      max-width: 68ch;
      font-size: 17px;
      line-height: 1.65;
    }
    .description :first-child {
      margin-top: 0;
    }
    .note {
      margin: 0 0 24px;
      padding: 12px 16px;
      border-left: 4px solid #f39c12;
      background: var(--color-surface);
      border-radius: 4px;
    }

    h2 {
      font-family: Montserrat, sans-serif;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-text-muted);
      margin: 0 0 12px;
      text-align: left;
    }
    h2::after {
      display: none;
    }
    .panel {
      padding: 20px;
      border: 1px solid var(--color-border-soft);
      border-radius: 8px;
      background: var(--color-surface);
    }
    .panel p {
      margin: 0 0 12px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 0 0 16px;
    }
    dt {
      color: var(--color-text-muted);
    }
    dd {
      margin: 0;
      font-weight: 600;
    }
    .directions {
      display: block;
      margin-top: 4px;
      font-weight: normal;
      color: var(--color-text-muted);
    }
    .cta {
      margin: 0;
      border: 1px solid #0066cc;
    }
    .cta.primary {
      width: 100%;
    }
    .calendar {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      margin-top: 12px;
      font-size: 14px;
      color: var(--color-text-muted);
    }
    .calendar a {
      text-decoration: underline;
      text-underline-offset: 2px;
    }
  `,
  imports: [
    RouterLink,
    SpeakerContainerComponent,
    UserFeedbackComponent,
    KeyValuePipe,
    GetSpeakerPipe,
  ],
})
export class SessionDetailsComponent {
  ds = inject(DataService);
  auth = inject(AuthService);

  environment = environment;

  readonly session = input<Session>(undefined);

  /** Whether the session has a slot on the public schedule. Without one, it's shown without a room or time. */
  scheduled = computed(() => this.ds.showSchedule() && !!this.session()?.startTime);

  /** When the session runs, e.g. "11:15 AM – 12:15 PM". */
  timeRange = computed(() => {
    const session = this.session();
    if (!session?.startTime) return '';
    const start = this.ds.customDateFormatter(session.startTime);
    const end = sessionEnd(session, this.ds.publishedSchedule());
    return end ? `${start} – ${this.ds.customDateFormatter(end)}` : start;
  });

  /** How to find this session's room, if it's one of the event's rooms. */
  roomDirections = computed(
    () => this.ds.rooms().find((room) => room.name === this.session()?.room)?.directions,
  );

  /** Links to add this session to a calendar, once it has a time. */
  calendar = computed(() => {
    const session = this.session();
    const event =
      session && calendarEvent(session, this.ds.publishedSchedule(), this.ds.showSchedule());
    return event && { google: googleCalendarUrl(event), ics: icsPath(session) };
  });

  agenda = inject(AgendaService);
  inAgenda = computed(() => this.agenda.has(this.session()?.$key));
}
