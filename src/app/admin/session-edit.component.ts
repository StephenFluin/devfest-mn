import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';


import { set } from 'firebase/database';
import { DataService, Session } from '../shared/data.service';
import { objectResource } from '../realtime-data/firebase';
import { SpeakerSelectorComponent } from './speaker-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { KeyValuePipe } from '@angular/common';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { environment } from '../../environments/environment';
import { eventUtcOffset } from '../shared/event-data';


@Component({
    templateUrl: './session-edit.component.html',
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
    ],
})
export class SessionEditComponent {
    ds = inject(DataService);
    route = inject(ActivatedRoute);
    router = inject(Router);

    private params = toSignal(this.route.paramMap, { requireSync: true });

    /** Kept at adminNotes/<session> rather than on the public session, so only admins can read it. */
    private adminNotes = objectResource<string>(
        () => {
            const id = this.params().get('id');
            return id === 'new' ? undefined : this.ds.ref(`adminNotes/${id}`);
        },
        { initialValue: '' }
    );

    /** A copy, so form edits don't leak into the shared live data before saving. */
    sessionData = computed<Session>(() => {
        const params = this.params();
        if (params.get('id') === 'new') {
            return { startTime: params.get('time'), room: params.get('room') };
        }
        const item = this.ds.schedule().find((item) => item.$key === params.get('id'));
        return item && { ...item, adminNotes: this.adminNotes() };
    });

    environment = environment;

    /**
     * Rooms are picked from the list at /admin/rooms, never typed, so names always match. A session
     * whose room isn't in that list keeps it as an extra option rather than losing it on save.
     */
    isKnownRoom(name: string) {
        return this.ds.rooms().some((room) => room.name === name);
    }

    /** The dropdown's "New room…" option. */
    readonly NEW_ROOM = '\u0000new-room';
    /** The name being typed for a new room, or null when picking from the list. */
    newRoom = signal<string | null>(null);
    creatingRoom = signal(false);
    roomError = signal('');

    pickRoom(session: Session, value: string) {
        if (value === this.NEW_ROOM) {
            this.roomError.set('');
            this.newRoom.set('');
        } else {
            session.room = value;
        }
    }

    /** Adds the room to the event's rooms (or finds it, if it exists) and puts the session in it. */
    async createRoom(session: Session) {
        const name = this.newRoom()?.trim();
        if (!name || this.creatingRoom()) return;
        this.creatingRoom.set(true);
        try {
            session.room = await this.ds.addRoom(name);
            this.newRoom.set(null);
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
        this.setTime(session, this.timeOf(session.startTime));
        // null also clears notes saved on the public session before they moved.
        const { adminNotes, ...publicSession } = session;
        const saved = this.ds.save('schedule', { ...publicSession, adminNotes: null });
        const key = session.$key ?? saved.key;
        set(this.ds.ref(`adminNotes/${key}`), adminNotes || null);
        this.router.navigate(['/', 'schedule']);
    }

    delete(session) {
        this.ds.delete('schedule', session);
        set(this.ds.ref(`adminNotes/${session.$key}`), null);
        this.router.navigate(['/', 'schedule']);
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
