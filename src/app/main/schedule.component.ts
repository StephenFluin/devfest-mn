import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataService, Session } from '../shared/data.service';

import { AuthService } from '../realtime-data/auth.service';
import { AgendaService } from '../shared/agenda.service';
import { MatButtonModule } from '@angular/material/button';
import { ScheduleGridComponent } from './schedule-grid.component';
import { OurMeta } from '../our-meta.service';
import { conferenceEvent, scheduledSessionEvents } from '../shared/event-data';
import { UntypedJson } from '../shared/untyped-json';

export interface Schedule {
  startTimes: string[];
  /** Start time → room (or "all") → session, or 'placeholder' for an empty slot. */
  gridData: UntypedJson;
  rooms: string[];
}

@Component({
  templateUrl: './schedule.component.html',
  styles: `
    .unpublished {
      max-width: 800px;
      margin: 40px auto;
      text-align: left;
    }
    .unpublished ul {
      list-style: none;
      padding: 0;
    }
    .unpublished li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      padding: 12px 0;
      border-top: 1px solid var(--color-border-soft);
    }
    .unpublished .session {
      flex: 1;
      min-width: 240px;
    }
    .unpublished .muted {
      color: var(--color-text-muted);
    }
  `,
  imports: [ScheduleGridComponent, MatButtonModule, RouterLink],
})
export class ScheduleComponent {
  ds = inject(DataService);
  authService = inject(AuthService);
  agenda = inject(AgendaService);
  private meta = inject(OurMeta);
  router = inject(Router);

  showAgenda = signal(false);
  /** Admins also see unpublished sessions, so they can lay out the schedule before publishing. */
  allSessions = computed(() =>
    this.buildGrid(
      (this.authService.isAdmin() ? this.ds.schedule() : this.ds.publishedSchedule()).filter(
        (session) => session.startTime,
      ),
    ),
  );
  populatedAgenda = computed(() => this.filterToMyAgenda(this.allSessions(), this.agenda.keys()));
  data = computed(() => (this.showAgenda() ? this.populatedAgenda() : this.allSessions()));

  /**
   * For admins: every unpublished session, including speakers' sessions that have no time or room yet
   * and so aren't in the grid.
   */
  unpublished = computed(() =>
    this.authService.isAdmin() ? this.ds.schedule().filter((session) => !session.published) : [],
  );

  speakerNames(session: Session) {
    return Object.values(session.speakers ?? {})
      .map((key) => this.ds.speaker(key)?.name ?? 'Unknown speaker')
      .join(', ');
  }

  /** Where the session is, e.g. "10 AM, Room A", or what it's still missing. */
  slot(session: Session) {
    const when = session.startTime ? this.ds.customDateFormatter(session.startTime) : 'No time yet';
    return session.room ? `${when}, ${session.room}` : `${when}, no room yet`;
  }

  publish(session: Session) {
    this.ds.save('schedule', { $key: session.$key, published: true });
  }

  delete(session: Session) {
    if (!confirm(`Delete "${session.title || 'this session'}"? This can't be undone.`)) return;
    this.ds.delete('schedule', session);
  }

  constructor() {
    // The conference with its scheduled sessions as sub-events.
    effect(() => {
      const events = scheduledSessionEvents(this.ds.publishedSchedule(), (key) =>
        this.ds.speaker(key),
      );
      this.meta.setStructuredData({
        '@context': 'https://schema.org',
        ...conferenceEvent(events.length ? { subEvent: events } : {}),
      });
    });
  }

  /**
   * Session data should look like data[time][room] = session;
   */
  buildGrid(list: Session[]): Schedule {
    const data = {};
    for (const session of list) {
      const time = session.startTime;
      if (typeof data[time] !== 'object') {
        data[time] = {};
      }

      // Get height of box
      if (!session.blocks) {
        session.blocks = 1;
      }
      if (session.track !== 'all' && session.track !== 'Keynote') {
        data[time][session.room] = session;
      } else {
        data[time]['all'] = session;
      }
    }

    const pad = (n) => (n < 10 ? '0' + n : n);
    // Look for holes
    for (const time in data) {
      if (Object.hasOwn(data, time)) {
        const slot = data[time];
        // Holes can only exist if there isn't an "all" session
        if (!slot.all) {
          for (const room of this.ds.getVenueLayout().rooms) {
            if (!slot[room]) {
              // Found a hole in this room, checking previous time slot
              const previous =
                time.substr(0, 11) + pad(parseInt(time.substr(11, 2), 10) - 1) + time.substr(13);

              if (!data[previous]) {
                // This is fine, it just means we're probably at the beginning of a day
                continue;
              }

              // Placeholder if there's nothing in the previous time slot, or there is and it's a short one
              if (!data[previous][room]) {
                data[time][room] = 'placeholder';
              } else if (!data[previous][room].blocks || data[previous][room].blocks < 2) {
                // This room has nothing in it!
                data[time][room] = 'placeholder';
              }
            }
          }
        }
      }
    }

    const startTimes = Object.keys(data).sort();
    return {
      startTimes: startTimes,
      gridData: data,
      rooms: this.ds.getVenueLayout().rooms,
    };
  }

  /**
   * Take in a full schedule and a set of agenda keys, return a new schedule of just those sessions the user has selected.
   */
  filterToMyAgenda(allData: Schedule, myAgendaKeys: Set<string>): Schedule {
    const result: Schedule = { startTimes: allData.startTimes, gridData: {}, rooms: [] };

    const resultSessions = {};
    const allSessions = allData.gridData;
    const rooms = [];

    for (const time in allSessions) {
      if (Object.hasOwn(allSessions, time)) {
        resultSessions[time] = {};

        const slot = allSessions[time];
        if (!slot.all) {
          for (const room in slot) {
            if (Object.hasOwn(slot, room)) {
              const session = slot[room];
              if (myAgendaKeys.has(session.$key)) {
                // Track which rooms we actually need.
                if (!(room in rooms)) {
                  rooms.push(room);
                }
                resultSessions[time][room] = session;
              }
            }
          }
        } else {
          // Ignore user preferences for "all" sessions
          resultSessions[time].all = slot.all;
        }
      }
    }

    // We do this to maintain the original order of the rooms
    const returnRooms = [];
    for (const room of this.ds.getVenueLayout().rooms) {
      if (rooms.indexOf(room) !== -1) {
        returnRooms.push(room);
      }
    }
    result.gridData = resultSessions;
    result.rooms = returnRooms;
    return result;
  }

  addSession() {
    this.router.navigate(['/', 'admin', 'sessions', 'new', 'edit']);
  }
}
