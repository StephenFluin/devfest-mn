import { Component, inject, input, output } from '@angular/core';
import { ref, query, orderByChild, push } from 'firebase/database';

import { Speaker } from '../shared/data.service';
import { DATABASE, listResource } from '../realtime-data/firebase';
import { environment } from '../../environments/environment';

@Component({
    selector: 'speaker-selector',
    template: ` @if (session().$key) {
        <div style="display:flex; flex-wrap:wrap">
            @for (speaker of speakers(); track speaker.$key) {
            <div style="border:1px solid #CCC;padding:16px;">
                <div>
                    {{ speaker.name }}
                    <button
                        type="button"
                        (click)="addSpeakerToSession(speaker.$key)"
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
})
export class SpeakerSelectorComponent {
    db = inject(DATABASE);

    speakers = listResource<Speaker>(
        () => query(ref(this.db, `devfest${environment.year}/speakers`), orderByChild('name')),
        '$key'
    );

    readonly session = input(undefined);
    readonly addSpeaker = output<string>();
    readonly removeSpeaker = output<string>();

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
