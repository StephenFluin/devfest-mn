import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';


import { set } from 'firebase/database';
import { DataService, Session } from '../shared/data.service';
import { objectResource } from '../realtime-data/firebase';
import { SpeakerSelectorComponent } from './speaker-selector.component';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { KeyValuePipe } from '@angular/common';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { environment } from '../../environments/environment';

/** Minneapolis's UTC offset on the event date, e.g. "-06:00". */
const eventUtcOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    timeZoneName: 'longOffset',
})
    .formatToParts(new Date(`${environment.eventDate}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')
    .value.replace('GMT', '');

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
