import { Component, EventEmitter, Output, OnChanges, inject, input } from '@angular/core';

import { AngularFireDatabase } from '@angular/fire/compat/database';

import { YearService } from '../year.service';
import { AsyncPipe } from '@angular/common';
import { Speaker } from '../shared/data.service';

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
    yearService = inject(YearService);

    speakers = this.db
        .list<Speaker>(`devfest${this.yearService.year}/speakers`, (ref) =>
            ref.orderByChild('name')
        )
        .snapshotChanges();

    readonly session = input(undefined);
    @Output() addSpeaker = new EventEmitter<string>();
    @Output() removeSpeaker = new EventEmitter<string>();

    schedule;
    ngOnChanges() {
        let path = `devfest${this.yearService.year}/speakers`;
        console.log('querying ', path);
        this.speakers.subscribe(console.log);
    }

    addSpeakerToSession(speakerKey: string) {
        const session = this.session();
        console.log('Adding', speakerKey, 'to ', session);
        let path = `devfest${this.yearService.year}/schedule/${session.$key}/speakers`;
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
