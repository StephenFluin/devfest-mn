import { Component, computed, inject } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { AuthService } from '../realtime-data/auth.service';
import { environment } from '../../environments/environment';

@Component({
    templateUrl: 'session-report.component.html',
})
export class SessionReportComponent {
    auth = inject(AuthService);
    year = environment.year;

    private allData = httpResource<{ feedback: any; schedule: any; speakers: any }>(
        () => `https://devfestmn-2026-default-rtdb.firebaseio.com/devfest${environment.year}.json`
    );

    sessions = computed(() => {
        const data = this.allData.hasValue() ? this.allData.value() : null;
        if (!data) {
            return [];
        }
        let tenthsRound = (x) => Math.round(x * 10) / 10;
        let feedback = data.feedback ?? {};
        let collectedFeedback = {};
        let sessions = data.schedule ?? {};
        let result = [];

        // Invert the array so we can do session lookups
        for (let user of Object.keys(feedback)) {
            for (let session of Object.keys(feedback[user])) {
                if (!collectedFeedback[session]) {
                    collectedFeedback[session] = [];
                }
                collectedFeedback[session].push(feedback[user][session]);
            }
        }

        // Generate Session Objects
        for (let session of Object.keys(sessions)) {
            let sessionData = {
                name: sessions[session].title,
                speakers: [],
                ratingsCount: 0,
                content: 0,
                recommendation: 0,
                speaker: 0,
                totalScore: 0,
            };

            // Speakers
            if (sessions[session].speakers) {
                for (let lookupKey of Object.keys(sessions[session].speakers)) {
                    let speakerKey = sessions[session].speakers[lookupKey];
                    // Have to do this if check because some speaker lists look like arrays
                    // and firebase fills in missing numbers with nulls
                    // Have to do second check because we had some pointers that pointed at speakers that didn't exist
                    if (speakerKey && data.speakers[speakerKey]) {
                        sessionData.speakers.push(data.speakers[speakerKey].name);
                    }
                }
            }

            // Ratings
            if (collectedFeedback[session]) {
                let count = 0;
                let contentCount = 0,
                    recommendationCount = 0,
                    speakerCount = 0;
                let content = 0,
                    recommendation = 0,
                    speaker = 0;

                for (let feedbackItem of collectedFeedback[session]) {
                    count++;
                    if (feedbackItem.content !== undefined) {
                        content += feedbackItem.content;
                        contentCount++;
                    }
                    if (feedbackItem.recommendation !== undefined) {
                        recommendation += feedbackItem.recommendation;
                        recommendationCount++;
                    }
                    if (feedbackItem.speaker !== undefined) {
                        speaker += feedbackItem.speaker;
                        speakerCount++;
                    }
                }

                sessionData.content = tenthsRound(content / contentCount);
                sessionData.recommendation = tenthsRound(
                    recommendation / recommendationCount
                );
                sessionData.speaker = tenthsRound(speaker / speakerCount);

                sessionData.ratingsCount = count;
                sessionData.totalScore =
                    sessionData.content +
                    sessionData.recommendation +
                    sessionData.speaker +
                    count / 5;
            }

            result.push(sessionData);
        }

        result = result.sort((a, b) => (a.totalScore < b.totalScore ? 1 : -1));

        return result;
    });
}
