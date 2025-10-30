import { Component, OnChanges, inject, input, output } from '@angular/core';

import { AngularFireDatabase } from '@angular/fire/compat/database';

import { AsyncPipe } from '@angular/common';
import { Speaker } from '../shared/data.service';
import { environment } from '../../environments/environment';

@Component({
    selector: 'speaker-selector',
    template: ` @if (session().$key) {
        <div style="display:flex; flex-wrap:wrap">
            @for (speakerSnapshot of speakers | async; track speakerSnapshot) {
            <div style="border:1px solid #CCC;padding:16px;">
                <div>
                    {{ speakerSnapshot.payload.val().name }}
                    <button
                        type="button"
                        (click)="addSpeakerToSession(speakerSnapshot.key)"
                        color="primary"
                    >
                        Add Speaker to Session
                    </button>
                </div>
            </div>
            }
        </div>
        } @if (!session().$key) {
        <div>Save your new session before adding speakers</div>
        }`,
    imports: [AsyncPipe],
})
export class SpeakerSelectorComponent implements OnChanges {
    db = inject(AngularFireDatabase);

    speakers = this.db
        .list<Speaker>(`devfest${environment.year}/speakers`, (ref) => ref.orderByChild('name'))
        .snapshotChanges();

    readonly session = input(undefined);
    readonly addSpeaker = output<string>();
    readonly removeSpeaker = output<string>();

    schedule;
    ngOnChanges() {
        let path = `devfest${environment.year}/speakers`;
        console.log('querying ', path);
        this.speakers.subscribe(console.log);
    }

    addSpeakerToSession(speakerKey: string) {
        const session = this.session();
        console.log('Adding', speakerKey, 'to ', session);
        let path = `devfest${environment.year}/schedule/${session.$key}/speakers`;
        console.log('path is', path);
        const speakerList = this.db.list(path);
        speakerList.push(speakerKey).then(
            () => {
                console.log('Speaker added successfully');
            },
            (err) => {
                console.error('Error adding speaker to session', err);
            }
        );
    }
}
