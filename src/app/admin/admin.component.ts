import { Component, inject } from '@angular/core';

import { AngularFireDatabase } from '@angular/fire/compat/database';

import { AsyncPipe } from '@angular/common';
import { AngularFireList } from '@angular/fire/compat/database';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../realtime-data/auth.service';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: './admin.component.html',
    imports: [RouterLink, RouterOutlet, AsyncPipe],
})
export class AdminComponent {
    db = inject(AngularFireDatabase);
    auth = inject(AuthService);

    schedule: AngularFireList<any>;
    speakers: AngularFireList<any>;

    editSession = {};
    editSpeaker = {};

    constructor() {
        const db = this.db;

        const PATH = `devfest${environment.year}`;
        this.schedule = db.list(PATH + '/schedule');
        this.speakers = db.list(PATH + '/speakers');
    }

    saveSession(session) {
        event.preventDefault();
        if (session.$key) {
            let key = session.$key;

            delete session.$key;
            delete session.$exists;
            delete session.$value;

            this.schedule.update(key, session);
        } else {
            this.schedule.push(session);
        }
        this.editSession = {};
    }
    saveSpeaker(speaker) {
        event.preventDefault();
        if (speaker.$key) {
            let key = speaker.$key;

            delete speaker.$key;
            delete speaker.$exists;
            delete speaker.$value;

            this.speakers.update(key, speaker);
        } else {
            this.speakers.push(speaker);
        }
        this.editSpeaker = {};
    }
    deleteSpeaker(key) {
        this.speakers.remove(key);
    }
    deleteSession(key) {
        this.schedule.remove(key);
    }
}
