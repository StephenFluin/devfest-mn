import { Component, OnChanges, inject, input, output } from '@angular/core';

import { Database, ref, query, orderByChild, push, onValue } from '@angular/fire/database';
import { Observable } from 'rxjs';

import { AsyncPipe } from '@angular/common';
import { Speaker } from '../shared/data.service';
import { environment } from '../../environments/environment';

interface SpeakerSnapshot {
    key: string;
    payload: {
        val: Speaker;
    };
}

@Component({
    selector: 'speaker-selector',
    template: ` @if (session().$key) {
        <div style="display:flex; flex-wrap:wrap">
            @for (speakerSnapshot of speakers | async; track speakerSnapshot) {
            <div style="border:1px solid #CCC;padding:16px;">
                <div>
                    {{ speakerSnapshot.payload.val.name }}
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
    db = inject(Database);

    speakers: Observable<SpeakerSnapshot[]> = new Observable((observer) => {
        const speakersRef = ref(this.db, `devfest${environment.year}/speakers`);
        const speakersQuery = query(speakersRef, orderByChild('name'));

        const unsubscribe = onValue(speakersQuery, (snapshot) => {
            const speakers: SpeakerSnapshot[] = [];
            snapshot.forEach((childSnapshot) => {
                speakers.push({
                    key: childSnapshot.key!,
                    payload: {
                        val: childSnapshot.val() as Speaker,
                    },
                });
            });
            observer.next(speakers);
        });

        return () => unsubscribe();
    });

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
        const speakersListRef = ref(this.db, path);
        push(speakersListRef, speakerKey).then(
            () => {
                console.log('Speaker added successfully');
            },
            (err) => {
                console.error('Error adding speaker to session', err);
            }
        );
    }
}
