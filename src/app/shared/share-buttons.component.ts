import { Component, input, signal } from '@angular/core';
import { ShareOption } from './share';

/**
 * One button per network for a set of share options: compose links open in a new tab, and the copy
 * option puts the post on the clipboard (for Slack, Discord, Mastodon, or anywhere else).
 */
@Component({
  selector: 'app-share-buttons',
  template: `
    <div class="share-buttons" role="group" [attr.aria-label]="label()">
      @for (option of options(); track option.network) {
        @if (option.href) {
          <a
            class="share-button"
            [class.primary]="option.network === 'linkedin'"
            [href]="option.href"
            target="_blank"
            rel="noopener"
            >{{ option.label }}</a
          >
        } @else {
          <button type="button" class="share-button" (click)="copy(option)">
            {{ copied() === option.network ? 'Copied!' : option.label }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    .share-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }
    .share-button {
      display: inline-block;
      margin: 0;
      padding: 8px 16px;
      border: 1px solid #0066cc;
      border-radius: 999px;
      background: transparent;
      color: #0066cc;
      font: inherit;
      font-size: 14px;
      font-weight: bold;
      font-family: Montserrat, sans-serif;
      cursor: pointer;
      transition: 0.2s;
    }
    .share-button.primary {
      background: #0066cc;
      color: #fff;
    }
    .share-button:hover,
    .share-button:focus-visible {
      background: #1696cb;
      border-color: #1696cb;
      color: #fff;
    }
    @media (prefers-color-scheme: dark) {
      .share-button {
        border-color: #6cb4ff;
        color: #6cb4ff;
      }
    }
  `,
})
export class ShareButtonsComponent {
  readonly options = input.required<ShareOption[]>();
  readonly label = input('Share');
  copied = signal<string | null>(null);

  async copy(option: ShareOption) {
    try {
      await navigator.clipboard.writeText(option.text);
      this.copied.set(option.network);
      setTimeout(() => this.copied.set(null), 2000);
    } catch {
      // Clipboard blocked (e.g. not a secure context); a prompt still lets them copy by hand.
      prompt('Copy this post:', option.text);
    }
  }
}
