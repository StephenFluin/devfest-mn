import { Component, computed, signal, inject, input, Signal } from '@angular/core';
import { Database, ref, objectVal, set } from '@angular/fire/database';
import { DataService, Session, Feedback } from '../shared/data.service';

import { switchMap, map } from 'rxjs/operators';
import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { StarBarComponent } from './star-bar.component';
import { environment } from '../../environments/environment';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';

@Component({
    selector: 'user-feedback',
    templateUrl: 'user-feedback.component.html',
    imports: [StarBarComponent, MatButtonModule],
})
export class UserFeedbackComponent {
    db = inject(Database);
    ds = inject(DataService);
    auth = inject(AuthService);

    environment = environment;

    readonly session = input<Session>(undefined);
    feedback: Signal<Feedback>;
    editableFeedbackPath: Signal<string | null>;
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
                switchMap((path) => {
                    if (path) {
                        return objectVal<Feedback>(ref(db, path));
                    }
                    return of({} as Feedback);
                }),
                map((feedback) => feedback || ({} as Feedback))
            ),
            { initialValue: {} as Feedback }
        );

        this.editableFeedbackPath = url;
    }

    saveSpeaker(val) {
        const currentFeedback = (this.feedback() || {}) as Feedback;
        currentFeedback.speaker = val;
        this.saveWithData(currentFeedback);
    }
    saveContent(val) {
        const currentFeedback = (this.feedback() || {}) as Feedback;
        currentFeedback.content = val;
        this.saveWithData(currentFeedback);
    }
    saveRecommendation(val) {
        const currentFeedback = (this.feedback() || {}) as Feedback;
        currentFeedback.recommendation = val;
        this.saveWithData(currentFeedback);
    }
    saveComment(val) {
        const currentFeedback = (this.feedback() || {}) as Feedback;
        currentFeedback.comment = val;
        this.saveWithData(currentFeedback);
    }

    saveWithData(feedbackData: Feedback) {
        const path = this.editableFeedbackPath();
        if (path) {
            const dataToSave = { ...feedbackData };
            delete dataToSave.$key;
            const feedbackRef = ref(this.db, path);
            set(feedbackRef, dataToSave).then((result) => {
                this.saved.set(true);
                setTimeout(() => {
                    this.saved.set(false);
                }, 2000);
            });
        }
    }

    save() {
        const feedbackData = (this.feedback() || {}) as Feedback;
        this.saveWithData(feedbackData);
    }
}
