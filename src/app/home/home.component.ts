import { Component, computed, DOCUMENT, effect, inject, PLATFORM_ID } from '@angular/core';
import { DatePipe, isPlatformServer } from '@angular/common';

import { environment } from '../../environments/environment';
import { RouterLink } from '@angular/router';

import { ADirective } from '../a.directive';

import { TicketEmbedComponent } from '../ticket-embed/ticket-embed.component';
import { OurMeta } from '../our-meta.service';
import { cfpCountdown, cfpState } from '../shared/cfp-deadline';
import { dayOf } from '../shared/day-of';
import { VenueComponent } from './venue.component';
import { DataService } from '../shared/data.service';
import { slugify } from '../shared/slug';
import { conferenceEvent, personRef } from '../shared/event-data';

@Component({
  templateUrl: './home.component.html',
  imports: [RouterLink, ADirective, TicketEmbedComponent, DatePipe, VenueComponent],
  styles: `
    .hero-title {
      margin: 0;
      font-size: inherit;
      line-height: 0;
    }
    .hero-subtitle {
      display: block;
      margin: 4px 0 16px;
      font-size: 22px;
      line-height: 1.3;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: #222;
    }
    .hero-cta {
      margin-top: 16px;
    }
    .featured-speakers {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 24px;
      margin: 24px 0;
    }
    .featured-speakers a {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 140px;
      text-align: center;
    }
    .featured-speakers img,
    .featured-speakers .no-photo {
      width: 96px;
      height: 96px;
      object-fit: cover;
      border-radius: 50%;
      margin-bottom: 8px;
    }
    .featured-speakers .no-photo {
      background: var(--color-surface-strong);
    }
    .hero-deadline {
      margin-top: 8px;
      font-size: 16px;
      color: #222;
    }
  `,
})
export class HomeComponent {
  environment = environment;
  faqSelection = 1;
  private meta = inject(OurMeta);
  cfpCountdown = cfpCountdown();
  cfp = cfpState();
  dayOf = dayOf();
  slugify = slugify;
  private ds = inject(DataService);

  /** Confirmed speakers; the home page's speakers section appears once there are any. */
  speakers = this.ds.confirmedSpeakers;
  featuredSpeakers = computed(() => this.speakers().slice(0, 6));

  constructor() {
    // The hero photo is the largest thing on screen, but as a CSS background the browser only
    // finds it after the stylesheet loads. Preloading it from the server-rendered HTML lets
    // the download start right away.
    if (isPlatformServer(inject(PLATFORM_ID))) {
      const doc = inject(DOCUMENT);
      const link = doc.createElement('link');
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('href', '/a/images/hero-cover.webp');
      link.setAttribute('fetchpriority', 'high');
      doc.head.appendChild(link);
    }
  }

  /** Event structured data; re-set when the confirmed speakers (its performers) change. */
  private eventData = effect(() => {
    const performers = this.speakers();
    this.meta.setStructuredData({
      '@context': 'https://schema.org',
      ...conferenceEvent(performers.length ? { performer: performers.map(personRef) } : {}),
    });
  });

  setFaqSelection(question) {
    this.faqSelection = question;
  }
}

export default HomeComponent;
