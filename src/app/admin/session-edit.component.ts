import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { set } from 'firebase/database';
import { DataService, Session, spansSchedule } from '../shared/data.service';
import { objectResource } from '../realtime-data/firebase';
import { EditHistoryComponent } from './edit-history.component';
import { SpeakerSelectorComponent } from './speaker-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe, Location } from '@angular/common';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { environment } from '../../environments/environment';
import { eventUtcOffset } from '../shared/event-data';
import { formChanged, UnsavedChangesForm, warnOnPageUnload } from '../shared/unsaved-changes';
import { SESSION_PLANNING_PATH } from './session-planning.component';

@Component({
  templateUrl: './session-edit.component.html',
  styles: `
    .room-choice {
      margin: 8px 0 0;
    }
    .room-choice p {
      margin-bottom: 8px;
    }
    .chips {
      margin-bottom: 16px;
    }
  `,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatAutocompleteModule,
    MatOptionModule,
    MatButtonModule,
    SpeakerSelectorComponent,
    KeyValuePipe,
    GetSpeakerPipe,
    RouterLink,
    MatSelectModule,
    TextFieldModule,
    MatCheckboxModule,
    EditHistoryComponent,
  ],
})
export class SessionEditComponent implements UnsavedChangesForm {
  ds = inject(DataService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  private params = toSignal(this.route.paramMap, { requireSync: true });

  /** Where Back, Cancel, save and delete go: session planning if opened from there, else the schedule. */
  readonly back =
    (inject(Location).getState() as { returnTo?: string } | null)?.returnTo ===
    SESSION_PLANNING_PATH
      ? { path: SESSION_PLANNING_PATH, label: 'Back to session planning' }
      : { path: '/schedule', label: 'Back to schedule' };

  /** Kept at adminNotes/<session> rather than on the public session, so only admins can read it. */
  private adminNotes = objectResource<string>(
    () => {
      const id = this.params().get('id');
      return id === 'new' ? undefined : this.ds.ref(`adminNotes/${id}`);
    },
    { initialValue: '' },
  );

  private original = computed<Session | undefined>(() => {
    const params = this.params();
    if (params.get('id') === 'new') {
      // Made from a slot in the schedule grid, so meant to be public; invited speakers' sessions
      // start unpublished instead (DataService.inviteSpeaker).
      return { startTime: params.get('time'), room: params.get('room'), published: true };
    }
    const item = this.ds.schedule().find((item) => item.$key === params.get('id'));
    return item && { ...item, adminNotes: this.adminNotes() };
  });

  /** A copy, so form edits don't leak into the shared live data before saving. */
  sessionData = computed<Session>(() => {
    const item = this.original();
    return item && { ...item };
  });

  /** Set once saved or deleted, when leaving the page no longer loses anything. */
  private finished = false;

  constructor() {
    warnOnPageUnload(this);
  }

  hasUnsavedChanges() {
    return !this.finished && formChanged(this.original(), this.sessionData());
  }

  environment = environment;

  /** Older sessions saved their length as text ("2"). */
  sameNumber = (a: unknown, b: unknown) => Number(a || 1) === Number(b || 1);

  /**
   * Suggestions for a session's track, its topic: this year's four, plus the two that span every
   * room. Each has a color on the schedule (styles.scss); another name works but shows in gray.
   */
  readonly tracks = ['Agents', 'Engineering', 'People', 'Business', 'all', 'Keynote'];

  /**
   * A room in the list at /admin/rooms is a schedule column. A session that spans the schedule
   * (Registration in the Foyer, say) can be in any place; others in an unlisted room get a column.
   */
  isKnownRoom(name: string) {
    return this.ds.rooms().some((room) => room.name === name.trim());
  }

  spans = spansSchedule;

  /** The listed rooms and other places sessions use, matching what's typed. */
  roomSuggestions(typed = '') {
    const names = [
      ...this.ds.rooms().map((room) => room.name),
      ...this.ds
        .schedule()
        .map((session) => session.room)
        .filter(Boolean)
        .sort(),
    ];
    const query = typed.trim().toLowerCase();
    return [...new Set(names)].filter((name) => name.toLowerCase().includes(query));
  }

  /** Tidies a typed room, and uses a listed room's exact name when it differs only in case. */
  matchRoom(session: Session) {
    const typed = session.room?.trim();
    const listed = this.roomSuggestions().find(
      (name) => name.toLowerCase() === typed?.toLowerCase(),
    );
    session.room = listed ?? (typed || undefined);
  }

  creatingRoom = signal(false);
  roomError = signal('');

  /** Adds the session's room to the event's rooms, making it a schedule column. */
  async addToRooms(session: Session) {
    const name = session.room?.trim();
    if (!name || this.creatingRoom()) return;
    this.creatingRoom.set(true);
    this.roomError.set('');
    try {
      session.room = await this.ds.addRoom(name);
    } catch (error) {
      console.error('Error adding room', error);
      this.roomError.set(`Couldn't add the room: ${error.message ?? error}`);
    } finally {
      this.creatingRoom.set(false);
    }
  }

  /** The wall-clock time of a stored start time, e.g. "13:40". */
  timeOf(startTime?: string) {
    return startTime?.slice(11, 16) ?? '';
  }

  /** Sessions are always on the event date, stored as e.g. 2026-12-05T13:40-06:00. */
  setTime(session: Session, time: string) {
    session.startTime = time ? `${environment.eventDate}T${time}${eventUtcOffset}` : undefined;
  }

  save(session, event?: Event) {
    if (event) {
      event.preventDefault();
    }
    this.finished = true;
    this.setTime(session, this.timeOf(session.startTime));
    // null also clears notes saved on the public session before they moved.
    const { adminNotes, ...publicSession } = session;
    const saved = this.ds.save('schedule', { ...publicSession, adminNotes: null });
    const key = session.$key ?? saved.key;
    set(this.ds.ref(`adminNotes/${key}`), adminNotes || null);
    this.router.navigateByUrl(this.back.path);
  }

  delete(session) {
    if (!confirm(`Delete "${session.title || 'this session'}"? This can't be undone.`)) return;
    this.finished = true;
    this.ds.delete('schedule', session);
    set(this.ds.ref(`adminNotes/${session.$key}`), null);
    this.router.navigateByUrl(this.back.path);
  }

  deleteSpeakerFromSession(session: Session, speakerKey: string) {
    this.ds.deleteSpeakerFromSession(session, speakerKey);
  }
  getValues(obj) {
    return Object.keys(obj).map((key) => obj[key]);
  }
}
// @Pipe({
//     name: 'getSpeaker',
//     standalone: true,
// })
// export class getSpeaker implements PipeTransform {
//     constructor(private ds: DataService) {
//         console.log('constructing pipe with ds', ds);
//     }

//     transform(value: string, destination: string): any {
//         if (value && destination && this.ds) {
//             console.log('generating observable for speaker at', value);
//             return this.ds
//                 .getSpeaker(value)
//                 .pipe(tap((speaker) => console.log('showing data for speaker', speaker)));
//         }
//     }
// }
