import { Component, computed, signal, inject, input } from '@angular/core';
import { ref, set } from 'firebase/database';
import { DATABASE, objectResource } from '../realtime-data/firebase';
import { DataService, Session, Feedback } from '../shared/data.service';

import { AuthService } from '../realtime-data/auth.service';
import { MatButtonModule } from '@angular/material/button';
import { StarBarComponent } from './star-bar.component';
import { environment } from '../../environments/environment';

@Component({
    selector: 'user-feedback',
    templateUrl: 'user-feedback.component.html',
    imports: [StarBarComponent, MatButtonModule],
})
export class UserFeedbackComponent {
    db = inject(DATABASE);
    ds = inject(DataService);
    auth = inject(AuthService);

    environment = environment;

    readonly session = input<Session>(undefined);
    uid;
    count = 0;
    saved = signal(false);
    saveButtonText = computed(() => (this.saved() ? 'Saved!' : 'Save'));
    saveButtonDisabled = computed(() => this.saved());

    editableFeedbackPath = computed(() => {
        const uid = this.auth.uid();
        const key = this.session()?.$key;
        return uid && key ? `/devfest${environment.year}/feedback/${uid}/${key}/` : null;
    });

    feedback = objectResource<Feedback>(
        () => (this.editableFeedbackPath() ? ref(this.db, this.editableFeedbackPath()) : undefined),
        { initialValue: {} as Feedback }
    );

    saveSpeaker(val) {
        this.saveWithData({ ...this.feedback(), speaker: val });
    }
    saveContent(val) {
        this.saveWithData({ ...this.feedback(), content: val });
    }
    saveRecommendation(val) {
        this.saveWithData({ ...this.feedback(), recommendation: val });
    }
    saveComment(val) {
        this.saveWithData({ ...this.feedback(), comment: val });
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
        this.saveWithData(this.feedback());
    }
}
