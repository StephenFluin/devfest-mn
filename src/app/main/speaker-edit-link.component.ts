import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-speaker-edit-link',
  imports: [RouterLink],
  template: `
    @if (link()) {
      <div
        class="link-actions"
        [class.copied]="copied()"
        role="group"
        [attr.aria-label]="'Speaker edit link for ' + name()"
      >
        <button
          type="button"
          (click)="copyLink.emit()"
          [attr.aria-label]="'Copy speaker edit link for ' + name()"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            @if (copied()) {
              <path d="m4 10 4 4 8-8" />
            } @else {
              <rect x="7" y="7" width="10" height="10" rx="2" />
              <path d="M12 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2" />
            }
          </svg>
          {{ copied() ? 'Link copied' : 'Copy edit link' }}
        </button>
        <a
          [href]="link()"
          rel="noreferrer"
          [attr.aria-label]="'Open speaker editor for ' + name()"
          title="Open speaker editor"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M11 3h6v6M17 3l-9 9M8 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3" />
          </svg>
        </a>
      </div>
      <span class="hint">{{
        copied() ? 'Ready to send to the speaker' : 'Share with the speaker'
      }}</span>
    } @else if (loading()) {
      <span class="hint">Loading edit link…</span>
    } @else if (!failed()) {
      <a class="create" [routerLink]="['/admin/speakers', speakerKey(), 'edit']"
        >Create speaker edit link</a
      >
      <span class="hint">No personal link yet</span>
    } @else {
      <span class="hint">Edit link unavailable</span>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 170px;
    }
    .link-actions {
      display: inline-flex;
      border: 1px solid var(--color-heading);
      border-radius: 5px;
    }
    button,
    .link-actions a {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      margin: 0;
      padding: 8px 10px;
      border: 0;
      background: transparent;
      color: var(--color-heading);
      font:
        500 13px/1.4 'Helvetica Neue',
        Helvetica,
        Arial,
        sans-serif;
      cursor: pointer;
      text-decoration: none;
      white-space: nowrap;
    }
    button {
      min-width: 128px;
      border-radius: 4px 0 0 4px;
      background: var(--color-surface);
    }
    .link-actions a {
      border-left: 1px solid var(--color-heading);
      border-radius: 0 4px 4px 0;
    }
    svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .hint {
      display: block;
      margin-top: 6px;
      color: var(--color-text-muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .create {
      display: inline-block;
      color: var(--color-heading);
      font-size: 13px;
      text-underline-offset: 3px;
    }
    button:hover,
    .link-actions a:hover {
      background: var(--color-surface-strong);
      opacity: 1;
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid var(--color-heading);
      outline-offset: 3px;
    }
    .copied button {
      background: var(--color-heading);
      color: var(--color-bg);
    }
    @media (pointer: coarse) {
      button,
      .link-actions a {
        min-height: 44px;
      }
    }
  `,
})
export class SpeakerEditLinkComponent {
  speakerKey = input.required<string>();
  name = input.required<string>();
  link = input<string>();
  copied = input(false);
  loading = input(false);
  failed = input(false);
  copyLink = output<void>();
}
