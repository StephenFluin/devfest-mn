import { Component, computed, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { completedOrder } from '../analytics.util';
import { attendeeShareOptions } from '../shared/share';
import { ShareButtonsComponent } from '../shared/share-buttons.component';
import { conferenceCalendarEvent, conferenceIcsPath, googleCalendarUrl } from '../shared/calendar';

/**
 * Shown once a ticket order completes: the buyer is the best person to reach colleagues and
 * friends who'd come but haven't heard of the event. Every share link is tagged so the UTM funnel
 * shows how many visits and sales attendees bring, per network. Also offers the day in their
 * calendar, which is one more reminder for them and anyone who can see it.
 */
@Component({
  selector: 'app-purchase-share',
  template: `
    @if (order() && !dismissed()) {
      <aside class="purchase-share" aria-labelledby="purchase-share-heading">
        <button type="button" class="close" (click)="dismissed.set(true)" aria-label="Close">
          ×
        </button>
        <h2 id="purchase-share-heading">You're in! See you {{ environment.eventDateDisplay }}.</h2>
        <p>
          Know a developer who'd love DevFestMN? Most people hear about it from someone they know.
        </p>
        <app-share-buttons [options]="options" label="Tell a friend" />
        <p class="calendar">
          Save the date:
          <a [href]="calendar.google" target="_blank" rel="noopener">Google Calendar</a> ·
          <a [href]="calendar.ics">Apple or Outlook</a>
        </p>
      </aside>
    }
  `,
  styles: `
    .purchase-share {
      position: fixed;
      left: 50%;
      bottom: 16px;
      transform: translateX(-50%);
      width: min(calc(100% - 32px), 560px);
      padding: 24px 32px;
      border-radius: 16px;
      background: var(--color-bg);
      color: var(--color-text);
      border: 1px solid var(--color-border);
      box-shadow: 0 8px 32px rgb(0 0 0 / 0.2);
      text-align: center;
      z-index: 90;
    }
    h2 {
      font-size: 22px;
      margin: 0 0 8px;
      color: var(--color-heading);
    }
    p {
      margin: 8px 0 16px;
      max-width: none;
    }
    .calendar {
      margin: 16px 0 0;
      font-size: 13px;
      color: var(--color-text-muted);
    }
    .calendar a {
      text-decoration: underline;
    }
    .close {
      position: absolute;
      top: 8px;
      right: 8px;
      margin: 0;
      width: 36px;
      height: 36px;
      padding: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 24px;
      line-height: 1;
    }
    .close:hover {
      background: var(--color-surface-strong);
    }
  `,
  imports: [ShareButtonsComponent],
})
export class PurchaseShareComponent {
  environment = environment;
  order = completedOrder;
  dismissed = signal(false);
  options = attendeeShareOptions();
  calendar = computed(() => ({
    google: googleCalendarUrl(conferenceCalendarEvent()),
    ics: conferenceIcsPath,
  }))();
}
