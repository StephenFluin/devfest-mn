import { Component, Input } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';

import { AngularFireDatabase, AngularFireObject } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { DataService, Session } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { UserFeedbackComponent } from './user-feedback.component';
import { SpeakerContainerComponent } from './speaker-container.component';
import { AsyncPipe, KeyValuePipe } from '@angular/common';

@Component({
    selector: 'session-details',
    templateUrl: 'session-details.component.html',
    imports: [
    RouterLink,
    SpeakerContainerComponent,
    UserFeedbackComponent,
    AsyncPipe,
    KeyValuePipe,
    GetSpeakerPipe
]
})
export class SessionDetailsComponent {
    @Input()
    session: Session;

    sessionAgenda: AngularFireObject<any>;
    sessionAgendaRead: Observable<any>;
    agendaInfo = this.route.params.pipe(
        switchMap((params) => {
            return this.auth.uid.pipe(map((uid) => ({ id: params['id'], uid: uid })));
        })
    );

    constructor(
        private route: ActivatedRoute,
        public ds: DataService,
        public auth: AuthService,
        public db: AngularFireDatabase
    ) {
        this.sessionAgendaRead = this.agendaInfo.pipe(
            switchMap((agendaData) => {
                let { id, uid } = agendaData;
                if (id && uid) {
                    const agenda = this.ds.getAgenda(uid, id);
                    this.sessionAgenda = agenda;
                    return agenda.valueChanges();
                } else {
                    return null;
                }
            })
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
