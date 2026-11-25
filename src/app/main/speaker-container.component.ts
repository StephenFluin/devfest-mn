import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { slugify } from '../shared/slug';
import { speakerLinks } from '../shared/speaker-links';

@Component({
  selector: 'app-speaker-container',
  template: `
    @if (speaker() && (speaker().published || showEdit())) {
      <div class="speaker-card" [class.unpublished]="!speaker().published">
        @if (speaker().imageUrl) {
          <img
            class="thumb"
            [src]="speaker().imageUrl"
            [alt]="'Photo of ' + speaker().name"
            width="72"
            height="72"
          />
        } @else {
          <div class="thumb thumb-initials" aria-hidden="true">{{ initials() }}</div>
        }
        <div class="speaker-content">
          @if (!speaker().published && showEdit()) {
            <span class="speaker-badge">Not published</span>
          }
          <a
            class="speaker-name"
            [routerLink]="['/', 'speakers', speaker().$key, slugify(speaker().name)]"
            >{{ speaker().name }}</a
          >
          @if (speaker().company) {
            <div class="speaker-company">{{ speaker().company }}</div>
          }
          @if (links().length) {
            <ul class="speaker-links">
              @for (link of links(); track link.url) {
                <li>
                  <a [href]="link.url" target="_blank" rel="me noopener">{{ link.label }}</a>
                </li>
              }
            </ul>
          }
        </div>
        @if (showEdit()) {
          <a
            class="speaker-edit"
            [routerLink]="['/', 'admin', 'speakers', speaker().$key, 'edit']"
            title="Edit speaker"
            ><img src="/a/edit.svg" alt="Edit speaker"
          /></a>
        }
      </div>
    }
  `,
  imports: [RouterLink],
})
export class SpeakerContainerComponent {
  readonly speaker = input(undefined);
  readonly showEdit = input(false);
  readonly initials = computed(() =>
    (this.speaker()?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );
  /** Only the links the speaker has supplied. */
  readonly links = computed(() => speakerLinks(this.speaker()));
  slugify = slugify;
}
