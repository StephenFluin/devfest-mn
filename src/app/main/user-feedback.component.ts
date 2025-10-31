import { Component, OnChanges, computed, signal, inject, input, Signal } from '@angular/core';
import { AngularFireDatabase, AngularFireObject } from '@angular/fire/compat/database';
import { DataService, Session, Feedback } from '../shared/data.service';

import { Subject, combineLatest, empty } from 'rxjs';
import { map, switchMap, tap, filter } from 'rxjs/operators';
import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { StarBarComponent } from './star-bar.component';
import { AsyncPipe } from '@angular/common';
import { environment } from '../../environments/environment';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'user-feedback',
    templateUrl: 'user-feedback.component.html',
    imports: [StarBarComponent, MatButtonModule, AsyncPipe],
})
export class UserFeedbackComponent {
    db = inject(AngularFireDatabase);
    ds = inject(DataService);
    auth = inject(AuthService);

    readonly session = input<Session>(undefined);
    feedback: Signal<Feedback>;
    editableFeedback: Signal<AngularFireObject<Feedback> | null>;
    uid;
    count = 0;
    saved = signal(false);
    saveButtonText = computed(() => (this.saved() ? 'Saved!' : 'Save'));
    saveButtonDisabled = computed(() => this.saved());

    constructor() {
        const db = this.db;

        let url = computed(() => {
            const uid = this.auth.uid();

            if (uid && this.session() && this.session().$key) {
                return `/devfest${environment.year}/feedback/${uid}/${this.session().$key}/`;
            } else {
                return null;
            }
        });

        this.feedback = toSignal(
            toObservable(url).pipe(
                switchMap((path) => this.db.object<Feedback>(path).valueChanges())
            )
        );

        this.editableFeedback = computed(() => {
            if (url()) {
                return db.object(url());
            }
            return null;
        });
    }

    saveSpeaker(val) {
        this.feedback().speaker = val;
        this.save();
    }
    saveContent(val) {
        this.feedback().content = val;
        this.save();
    }
    saveRecommendation(val) {
        this.feedback().recommendation = val;
        this.save();
    }
    saveComment(val) {
        this.feedback().comment = val;
        this.save();
    }
    save() {
        if (this.editableFeedback()) {
            delete this.feedback().$key;
            this.editableFeedback()
                .set(this.feedback())
                .then((result) => {
                    this.saved.set(true);
                    setTimeout(() => {
                        this.saved.set(false);
                    }, 2000);
                });
        } else {
        }
    }
}
