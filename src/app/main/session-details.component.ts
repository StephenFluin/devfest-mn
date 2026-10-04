import { Component, computed, inject, input } from '@angular/core';

import { RouterLink } from '@angular/router';
import { remove, set } from 'firebase/database';

import { DataService, Session } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { UserFeedbackComponent } from './user-feedback.component';
import { SpeakerContainerComponent } from './speaker-container.component';
import { KeyValuePipe } from '@angular/common';
import { objectResource } from '../realtime-data/firebase';
import { environment } from '../../environments/environment';

@Component({
    selector: 'session-details',
    templateUrl: 'session-details.component.html',
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

    private agendaRef = computed(() => {
        const uid = this.auth.uid();
        const key = this.session()?.$key;
        return uid && key ? this.ds.agendaRef(uid, key) : undefined;
    });
    inAgenda = objectResource<{ value: boolean } | null>(() => this.agendaRef(), {
        initialValue: null,
    });

    addToAgenda() {
        set(this.agendaRef(), { value: true }).catch((error) =>
            console.error('failure while saving user agenda', error)
        );
    }
    removeFromAgenda() {
        remove(this.agendaRef());
    }
}
