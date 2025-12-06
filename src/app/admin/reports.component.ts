import { Component, inject } from '@angular/core';

import { DataService } from '../shared/data.service';
import { AngularFireDatabase } from '@angular/fire/compat/database';

import { Observable, combineLatest } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AuthService } from '../realtime-data/auth.service';
import { AsyncPipe, DecimalPipe } from '@angular/common';
import { AdminNavComponent } from './admin-nav.component';
import { environment } from '../../environments/environment';

interface SessionFeedback {
    speaker: number;
    content: number;
    recommendation: number;
    comment?: string;
    uid: string;
}

interface SessionReport {
    key: string;
    title: string;
    startTime: string;
    numReviews: number;
    avgSpeaker: number;
    avgContent: number;
    avgRecommendation: number;
    feedback: SessionFeedback[];
}

@Component({
    template: `
        <admin-nav></admin-nav>
        @if (auth.isAdmin()) { @if (sessions | async; as sessionList) {
        <div>
            <h2>Session Feedback Report</h2>
            @for (session of sessionList; track session.key) {
            <div style="margin-bottom: 2rem;">
                <div>
                    <strong>{{ session.title }}</strong>
                </div>
                @if (session.numReviews > 0) {
                <div>
                    <div>{{ session.numReviews }} Reviews</div>
                    <div>
                        Avg Speaker: {{ session.avgSpeaker | number : '1.1-1' }} / Avg Content:
                        {{ session.avgContent | number : '1.1-1' }} / Avg Recommendation:
                        {{ session.avgRecommendation | number : '1.1-1' }}
                    </div>
                    <table border="1" style="margin-top: 0.5rem;">
                        <thead>
                            <tr>
                                <th>Speaker</th>
                                <th>Content</th>
                                <th>Recommendation</th>
                                <th>Comment</th>
                                <th>User ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            @for (fb of session.feedback; track fb.uid) {
                            <tr>
                                <td>{{ fb.speaker || '-' }}</td>
                                <td>{{ fb.content || '-' }}</td>
                                <td>{{ fb.recommendation || '-' }}</td>
                                <td>{{ fb.comment || '' }}</td>
                                <td>{{ fb.uid }}</td>
                            </tr>
                            }
                        </tbody>
                    </table>
                </div>
                } @else {
                <div style="color: #999;">No reviews yet</div>
                }
            </div>
            }
        </div>
        } }
    `,
    imports: [AdminNavComponent, AsyncPipe, DecimalPipe],
})
export class ReportsComponent {
    auth = inject(AuthService);
    db = inject(AngularFireDatabase);
    ds = inject(DataService);

    sessions: Observable<SessionReport[]>;

    constructor() {
        const ds = this.ds;

        this.sessions = combineLatest([ds.getFeedback(), ds.getSchedule(environment.year)]).pipe(
            tap((data) => console.log('Feedback and sessions data:', data)),
            map(([feedbackData, originalSessions]) => {
                // Create a map to collect feedback by session key
                const feedbackBySession = new Map<string, SessionFeedback[]>();

                // Process feedback data
                if (Array.isArray(feedbackData)) {
                    for (let user of feedbackData) {
                        const userId = user.$key;
                        for (let sessionKey of Object.keys(user)) {
                            if (sessionKey === '$key') continue;

                            if (!feedbackBySession.has(sessionKey)) {
                                feedbackBySession.set(sessionKey, []);
                            }

                            const userFeedback: SessionFeedback = {
                                speaker: user[sessionKey].speaker || 0,
                                content: user[sessionKey].content || 0,
                                recommendation: user[sessionKey].recommendation || 0,
                                comment: user[sessionKey].comment || '',
                                uid: userId,
                            };

                            feedbackBySession.get(sessionKey)!.push(userFeedback);
                        }
                    }
                }

                // Create session reports
                const sessionReports: SessionReport[] = [];

                for (let session of originalSessions) {
                    const sessionKey = session.$key;
                    const feedbackList = feedbackBySession.get(sessionKey) || [];

                    // Calculate averages (excluding zero values)
                    let totalSpeaker = 0,
                        totalContent = 0,
                        totalRecommendation = 0;
                    let validCount = 0;

                    for (let fb of feedbackList) {
                        if (fb.speaker > 0 && fb.content > 0 && fb.recommendation > 0) {
                            totalSpeaker += fb.speaker;
                            totalContent += fb.content;
                            totalRecommendation += fb.recommendation;
                            validCount++;
                        }
                    }

                    const report: SessionReport = {
                        key: sessionKey,
                        title: session.title || 'Untitled Session',
                        startTime: session.startTime || '',
                        numReviews: feedbackList.length,
                        avgSpeaker: validCount > 0 ? totalSpeaker / validCount : 0,
                        avgContent: validCount > 0 ? totalContent / validCount : 0,
                        avgRecommendation: validCount > 0 ? totalRecommendation / validCount : 0,
                        feedback: feedbackList,
                    };

                    sessionReports.push(report);
                }

                // Sort by start time
                sessionReports.sort((a, b) => {
                    return a.startTime.localeCompare(b.startTime);
                });

                return sessionReports;
            })
        );
    }
}
