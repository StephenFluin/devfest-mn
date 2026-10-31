import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { slugify } from '../shared/slug';

@Component({
  selector: 'app-speaker-container',
  template: `
    @if (speaker() && (speaker().published || showEdit())) {
      <div class="speaker-card" [class.unpublished]="!speaker().published">
        @if (speaker().imageUrl) {
          <div class="thumb" [style.background-image]="'url(' + speaker().imageUrl + ')'"></div>
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
          @if (speaker().twitter) {
            <a
              class="speaker-handle"
              href="https://twitter.com/{{ speaker().twitter }}"
              target="_blank"
              >&#64;{{ speaker().twitter }}</a
            >
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
  slugify = slugify;
}
