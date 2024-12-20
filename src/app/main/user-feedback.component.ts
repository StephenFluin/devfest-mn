import { Component, OnChanges, computed, signal, inject, input } from '@angular/core';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/compat/database';
import { DataService, Session, Feedback } from '../shared/data.service';

import { Subject, combineLatest, empty } from 'rxjs';
import { map, switchMap, tap, filter } from 'rxjs/operators';
import { YearService } from '../year.service';
import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { StarBarComponent } from './star-bar.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'user-feedback',
    templateUrl: 'user-feedback.component.html',
    imports: [StarBarComponent, MatButtonModule, AsyncPipe]
})
export class UserFeedbackComponent implements OnChanges {
    db = inject(AngularFireDatabase);
    ds = inject(DataService);
    auth = inject(AuthService);
    yearService = inject(YearService);

    readonly session = input(undefined);
    feedback: Feedback = { $key: null, speaker: 0, content: 0, recommendation: 0, comment: ' ' };
    editableFeedback: AngularFireObject<any>;
    uid;
    count = 0;
    saved = signal(false);
    saveButtonText = computed(() => (this.saved() ? 'Saved!' : 'Save'));
    saveButtonDisabled = computed(() => this.saved());

    newSession: Subject<Session> = new Subject();

    constructor() {
        const db = this.db;
        const yearService = this.yearService;

        let url = combineLatest(this.auth.uid, this.newSession).pipe(
            map((combinedData) => {
                let [uid, session] = combinedData;
                if (uid && session && session.$key) {
                    return `/devfest${yearService.year}/feedback/${uid}/${session.$key}/`;
                } else {
                    return null;
                }
            })
        );

        url.pipe(
            tap((path) => {
                console.log('fetching data for', path);
            }),
            switchMap((path) => (path ? db.object<Feedback>(path).valueChanges() : empty())),
            filter((x) => !!x)
        ).subscribe((feedback) => {
            this.feedback = feedback;
        });

        url.subscribe((path) => {
            if (path) {
                this.editableFeedback = db.object(path);
            }
        });
    }

    ngOnChanges() {
        const session = this.session();
        if (session && this.count++ < 10) {
            console.log('nexting newSession');
            this.newSession.next(session);
        }
    }
    saveSpeaker(val) {
        this.feedback.speaker = val;
        this.save();
    }
    saveContent(val) {
        this.feedback.content = val;
        this.save();
    }
    saveRecommendation(val) {
        this.feedback.recommendation = val;
        this.save();
    }
    saveComment(val) {
        this.feedback.comment = val;
        this.save();
    }
    save() {
        if (this.editableFeedback) {
            delete this.feedback.$key;
            this.editableFeedback.set(this.feedback).then((result) => {
                this.saved.set(true);
                setTimeout(() => {
                    this.saved.set(false);
                }, 2000);
            });
        } else {
        }
    }
}
