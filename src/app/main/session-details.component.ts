import { Component, computed, inject, input, Signal } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';

import { Observable } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import { DataService, Session } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { UserFeedbackComponent } from './user-feedback.component';
import { SpeakerContainerComponent } from './speaker-container.component';
import { AsyncPipe, KeyValuePipe } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'session-details',
    templateUrl: 'session-details.component.html',
    imports: [
        RouterLink,
        SpeakerContainerComponent,
        UserFeedbackComponent,
        AsyncPipe,
        KeyValuePipe,
        GetSpeakerPipe,
    ],
})
export class SessionDetailsComponent {
    private route = inject(ActivatedRoute);
    ds = inject(DataService);
    auth = inject(AuthService);

    readonly session = input<Session>(undefined);

    sessionAgenda: any;
    sessionAgendaRead: Signal<boolean>;

    routeParams = toSignal(this.route.params);
    agendaInfo = computed(() => {
        return { id: this.routeParams()['id'], uid: this.auth.uid() };
    });

    constructor() {
        this.sessionAgendaRead = toSignal(
            toObservable(this.agendaInfo).pipe(
                switchMap((value) => this.ds.getAgenda(value.uid, value.id).valueChanges()),
                map((wrapper) => wrapper.value),
                tap((agenda) => {
                    this.sessionAgenda = agenda;
                })
            )
        );
    }

    addToAgenda() {
        if (this.sessionAgenda) {
            this.sessionAgenda
                .set({ value: true })
                .then(() => {
                    console.log('Successfully updated the agenda.');
                })
                .catch((error) => {
                    console.error('failure while saving user agenda', error);
                });
        } else {
            console.error('Cannot modify agenda as we do not have a path or user');
        }
    }
    removeFromAgenda() {
        if (this.sessionAgenda) {
            this.sessionAgenda.remove();
        } else {
            console.error('Cannot modify agenda as we do not have a path or user');
        }
    }
}
