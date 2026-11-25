import { Component, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

/** Copies some text to the clipboard, such as a link shown next to the button. For admin pages. */
@Component({
  selector: 'app-copy-button',
  template: `
    <button mat-button type="button" (click)="copy()" [attr.aria-label]="label()">
      {{ copied() ? 'Copied' : 'Copy' }}
    </button>
    <span class="visually-hidden" role="status">{{ copied() ? 'Copied to clipboard' : '' }}</span>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  imports: [MatButtonModule],
})
export class CopyButtonComponent {
  /** What to copy. */
  readonly text = input.required<string>();
  /** What the button does, for screen readers, e.g. "Copy share link". */
  readonly label = input('Copy');

  copied = signal(false);

  async copy() {
    try {
      await navigator.clipboard.writeText(this.text());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // No clipboard access (an insecure page, or permission denied): show it to copy by hand.
      prompt('Copy this:', this.text());
    }
  }
}
