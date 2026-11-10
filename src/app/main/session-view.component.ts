import { Component, computed, effect, inject, RESPONSE_INIT } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { storedHtml } from '../shared/markdown';
import { slugify, summarize } from '../shared/slug';

import { DataService, Session } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { OurMeta } from '../our-meta.service';
import { SessionDetailsComponent } from './session-details.component';
import { environment } from '../../environments/environment';
import { sessionEvent } from '../shared/event-data';

@Component({
  templateUrl: './session-view.component.html',
  imports: [SessionDetailsComponent, RouterLink],
})
export class SessionViewComponent {
  year = environment.year;
  private ds = inject(DataService);
  private auth = inject(AuthService);
  private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  session = computed<Session | undefined>(() => {
    // Admins can open unpublished sessions from the schedule grid.
    const sessions = this.auth.isAdmin() ? this.ds.schedule() : this.ds.publishedSchedule();
    const item = sessions.find((s) => s.$key === this.params().get('id'));
    if (!item) {
      return undefined;
    }
    return {
      ...item,
      renderedDescription: storedHtml(item.renderedDescription, item.description),
    };
  });

  /** Old or mistyped links answer 404 so search engines drop them instead of indexing an empty page. */
  notFound = computed(() => this.ds.schedule.loaded() && !this.session());

  constructor() {
    const meta = inject(OurMeta);
    const response = inject(RESPONSE_INIT, { optional: true });
    effect(() => {
      if (this.notFound()) {
        meta.setTitle('Session not found');
        if (response) {
          response.status = 404;
        }
      }
    });
    effect(() => {
      const session = this.session();
      if (session?.title) {
        meta.setTitle(session.title);
        meta.setCanonical(`schedule/${session.$key}/${slugify(session.title)}`);
        if (session.description) {
          meta.setDescription(summarize(session.description));
        }
        const event = sessionEvent(
          session,
          this.ds.publishedSchedule(),
          (key) => this.ds.speaker(key),
          { standalone: true },
        );
        if (event) {
          meta.setStructuredData({ '@context': 'https://schema.org', ...event });
        }
      }
    });
  }
}
