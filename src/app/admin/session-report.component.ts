import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../realtime-data/auth.service';
import { objectResource } from '../realtime-data/firebase';
import { DataService } from '../shared/data.service';
import { environment } from '../../environments/environment';
import { UntypedJson } from '../shared/untyped-json';

@Component({
  templateUrl: 'session-report.component.html',
})
export class SessionReportComponent {
  auth = inject(AuthService);
  year = environment.year;

  private ds = inject(DataService);

  // Read through the SDK so the request carries the admin's credentials; feedback is admin-only.
  private feedback = objectResource<UntypedJson>(() => this.ds.ref('feedback'), {
    initialValue: {},
  });
  private schedule = objectResource<UntypedJson>(() => this.ds.ref('schedule'), {
    initialValue: {},
  });
  private speakers = objectResource<UntypedJson>(() => this.ds.ref('speakers'), {
    initialValue: {},
  });

  /** Sessions with speakers; the others (breaks, registration) aren't rated. */
  rated = computed(() => this.sessions().filter((session) => session.speakers.length > 0));

  sessions = computed(() => {
    const data = {
      feedback: this.feedback(),
      schedule: this.schedule(),
      speakers: this.speakers(),
    };
    const tenthsRound = (x) => Math.round(x * 10) / 10;
    const feedback = data.feedback ?? {};
    const collectedFeedback = {};
    const sessions = data.schedule ?? {};
    let result = [];

    // Invert the array so we can do session lookups
    for (const user of Object.keys(feedback)) {
      for (const session of Object.keys(feedback[user])) {
        if (!collectedFeedback[session]) {
          collectedFeedback[session] = [];
        }
        collectedFeedback[session].push(feedback[user][session]);
      }
    }

    // Generate Session Objects
    for (const session of Object.keys(sessions)) {
      const sessionData = {
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
        for (const lookupKey of Object.keys(sessions[session].speakers)) {
          const speakerKey = sessions[session].speakers[lookupKey];
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

        for (const feedbackItem of collectedFeedback[session]) {
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
        sessionData.recommendation = tenthsRound(recommendation / recommendationCount);
        sessionData.speaker = tenthsRound(speaker / speakerCount);

        sessionData.ratingsCount = count;
        sessionData.totalScore =
          sessionData.content + sessionData.recommendation + sessionData.speaker + count / 5;
      }

      result.push(sessionData);
    }

    result = result.sort((a, b) => (a.totalScore < b.totalScore ? 1 : -1));

    return result;
  });
}
