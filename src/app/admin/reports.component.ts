import { Component, computed, inject } from '@angular/core';

import { DataService, Feedback } from '../shared/data.service';
import { listResource } from '../realtime-data/firebase';

import { AuthService } from '../realtime-data/auth.service';
import { DecimalPipe } from '@angular/common';

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
    @if (auth.isAdmin()) {
      <div class="page-header">
        <div>
          <h2>Session feedback</h2>
          <p class="muted">
            Every rating and comment attendees left, by session, in schedule order. Ratings are out
            of 5.
          </p>
        </div>
      </div>
      @for (session of sessions(); track session.key) {
        <section class="card" [attr.aria-labelledby]="'fb-' + session.key">
          <div class="session-head">
            <h3 [id]="'fb-' + session.key">{{ session.title }}</h3>
            <span class="muted"
              >{{ session.numReviews }} {{ session.numReviews === 1 ? 'review' : 'reviews' }}</span
            >
          </div>
          @if (session.numReviews > 0) {
            <div class="scores">
              <div class="tile">
                <span class="label">Speaker</span
                ><span class="value">{{ session.avgSpeaker | number: '1.1-1' }}</span>
              </div>
              <div class="tile">
                <span class="label">Content</span
                ><span class="value">{{ session.avgContent | number: '1.1-1' }}</span>
              </div>
              <div class="tile">
                <span class="label">Recommend</span
                ><span class="value">{{ session.avgRecommendation | number: '1.1-1' }}</span>
              </div>
            </div>
            <div class="table-wrap">
              <table class="data">
                <thead>
                  <tr>
                    <th scope="col">Speaker</th>
                    <th scope="col">Content</th>
                    <th scope="col">Recommend</th>
                    <th scope="col" class="text">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fb of session.feedback; track fb.uid) {
                    <tr>
                      <td>{{ fb.speaker || '–' }}</td>
                      <td>{{ fb.content || '–' }}</td>
                      <td>{{ fb.recommendation || '–' }}</td>
                      <td class="text" [title]="'From user ' + fb.uid">{{ fb.comment }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted">No reviews yet.</p>
          }
        </section>
      } @empty {
        <p class="muted">No sessions yet.</p>
      }
    }
  `,
  styles: `
    .session-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .session-head h3 {
      margin: 0;
    }
    .scores {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 160px));
      gap: 12px;
      margin-bottom: 16px;
    }
    .scores .value {
      font: var(--mat-sys-headline-medium);
      font-weight: 600;
    }
    .data .text {
      min-width: 240px;
    }
  `,
  imports: [DecimalPipe],
})
export class ReportsComponent {
  auth = inject(AuthService);
  ds = inject(DataService);
  private feedback = listResource<Feedback>(() => this.ds.ref('feedback'), '$key');

  sessions = computed(() => {
    const feedbackData = this.feedback();
    const originalSessions = this.ds.schedule();
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
  });
}
