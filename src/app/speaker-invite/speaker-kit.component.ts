import { Component, computed, inject, input } from '@angular/core';
import { environment } from '../../environments/environment';
import { DataService, Speaker } from '../shared/data.service';
import { speakerShareOptions } from '../shared/share';
import { ShareButtonsComponent } from '../shared/share-buttons.component';
import { slugify } from '../shared/slug';
import { speakerPageUrl } from './invite-email';

/**
 * A confirmed speaker's share kit: their share card, short link and a ready-made post per network.
 * Shown to the speaker on their edit page and to admins in the speaker editor. Speakers reach the
 * exact audience the event wants, and the /s/ link credits their visits and sales to them.
 */
@Component({
  selector: 'app-speaker-kit',
  template: `
    @if (speaker(); as speaker) {
      <div class="kit">
        <img
          class="card"
          [src]="cardUrl()"
          [alt]="'Share card for ' + speaker.name"
          width="600"
          height="315"
          loading="lazy"
        />
        <p>
          Your link, which shows this card when posted:
          <a [href]="link()">{{ link() }}</a>
        </p>
        <app-share-buttons [options]="options()" label="Share your talk" />
      </div>
    }
  `,
  styles: `
    .kit {
      text-align: center;
    }
    .card {
      width: 100%;
      max-width: 600px;
      height: auto;
      border-radius: 8px;
      border: 1px solid var(--color-border-soft);
    }
    p {
      word-break: break-all;
    }
  `,
  imports: [ShareButtonsComponent],
})
export class SpeakerKitComponent {
  private ds = inject(DataService);
  readonly speaker = input.required<Speaker | undefined>();

  private slug = computed(() => slugify(this.speaker()?.name));
  private sessions = computed(() => this.ds.sessionsFor(this.speaker()?.$key));
  link = computed(() => speakerPageUrl(this.slug()));
  options = computed(() =>
    speakerShareOptions(
      this.slug(),
      this.sessions()
        .map((session) => session.title)
        .filter(Boolean),
    ),
  );
  /** Same versioned URL the speaker page uses for its og:image, so the preview is the real card. */
  cardUrl = computed(() => {
    const speaker = this.speaker();
    const version = Math.max(
      speaker?.updatedAt ?? 0,
      ...this.sessions().map((session) => session.updatedAt ?? 0),
    );
    return `${environment.siteUrl}/og/speakers/${speaker?.$key}.png?v=${version}`;
  });
}
