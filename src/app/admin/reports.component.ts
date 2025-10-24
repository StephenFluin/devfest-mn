import { Component, inject } from '@angular/core';

import { DataService } from '../shared/data.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';

import { Observable, combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AuthService } from '../realtime-data/auth.service';
import { AsyncPipe } from '@angular/common';
import { AdminNavComponent } from './admin-nav.component';
import { environment } from '../../environments/environment';

@Component({
    template: `
        <admin-nav></admin-nav>
        @if (auth.isAdmin()) {
        <div>
            <h2>Speaker</h2>
            @for (session of sessions | async; track session) {
            <div>
                <div>
                    <strong>{{ session.title }}</strong>
                </div>
                @if (session.feedback) {
                <div>
                    {{ session.feedback.length }} Reviews
                    <div>
                        Speaker: {{ session.scoreSpeaker }} / Content: {{ session.scoreContent }} /
                        Recommendation: {{ session.scoreRecommendation }}
                    </div>
                    <table border="1">
                        <tr>
                            <td>S</td>
                            <td>C</td>
                            <td>R</td>
                        </tr>
                        @for (feedback of session.feedback; track feedback) {
                        <tr>
                            <td>{{ feedback.speaker }}</td>
                            <td>{{ feedback.content }}</td>
                            <td>{{ feedback.recommendation }}</td>
                        </tr>
                        }
                    </table>
                </div>
                }
                <br />
            </div>
            }
            <h2>Overall Feedback</h2>
            <ol>
                @for (session of sessions | async; track session) {
                <div>
                    @for (feedback of session.feedback; track feedback) {
                    <div>
                        <li>
                            {{ feedback.speaker }} / {{ feedback.content }} /
                            {{ feedback.recommendation }} - {{ feedback.uid }}
                        </li>
                    </div>
                    }
                </div>
                }
            </ol>
        </div>
        }
    `,
    imports: [AdminNavComponent, AsyncPipe],
})
export class ReportsComponent {
    auth = inject(AuthService);
    db = inject(AngularFireDatabase);
    ds = inject(DataService);

    feedback: Observable<any>;
    sessions: Observable<
        {
            title: string;
            scoreSpeaker: number;
            scoreContent: number;
            scoreRecommendation: number;
            feedback?: any[];
        }[]
    >;

    constructor() {
        const ds = this.ds;

        this.feedback = ds.getFeedback();
        this.sessions = combineLatest(this.feedback, ds.getSchedule(environment.year)).pipe(
            tap((data) => console.log(data)),
            map((data) => {
                let [feedback, originalSession] = data;

                // clone the data
                let sessions = JSON.parse(JSON.stringify(originalSession));

                delete feedback.$key;
                delete feedback.$exists;
                delete feedback.$value;

                // Add feedback
                for (let uid of Object.keys(feedback)) {
                    let user = feedback[uid];
                    for (let sessionKey of Object.keys(user)) {
                        let session = sessions.find((item) => item.$key === sessionKey);
                        if (session) {
                            if (!session.feedback) {
                                session.feedback = [];
                            }
                            user[sessionKey].uid = uid;
                            session.feedback.push(user[sessionKey]);
                        }
                    }
                }

                // Summarize feedback
                for (let session of sessions) {
                    session.scoreSpeaker = session.scoreContent = session.scoreRecommendation = 0;
                    if (session.feedback) {
                        let length = session.feedback.length;
                        for (let feedbackResult of session.feedback) {
                            if (
                                feedbackResult.speaker === 0 ||
                                feedbackResult.content === 0 ||
                                feedbackResult.recommendation === 0
                            ) {
                                length--;
                            } else {
                                session.scoreSpeaker += feedbackResult.speaker;
                                session.scoreContent += feedbackResult.content;
                                session.scoreRecommendation += feedbackResult.recommendation;
                            }
                        }
                        session.scoreSpeaker = session.scoreSpeaker / session.feedback.length;
                        session.scoreContent = session.scoreContent / session.feedback.length;
                        session.scoreRecommendation =
                            session.scoreRecommendation / session.feedback.length;
                    }
                }

                // Sort Feedback
                sessions = sessions.sort((a, b) => {
                    return a.scoreSpeaker + a.scoreContent + a.scoreRecommendation >
                        b.scoreSpeaker + b.scoreContent + b.scoreRecommendation
                        ? -1
                        : 1;
                });

                return sessions;
            }),
            tap((data) => console.log('processed data', data))
        );
    }
}
