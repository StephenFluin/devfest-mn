import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  Component,
  createComponent,
  DestroyRef,
  ElementRef,
  EnvironmentInjector,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

/** A routed page with a form that shouldn't be left with edits it hasn't saved. */
export interface UnsavedChangesForm {
  hasUnsavedChanges(): boolean;
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || value === '' || value === false;

/**
 * Whether a form's working copy differs from the data it was copied from. Empty values all count as
 * unset, since clearing an input leaves "" and unticking a box leaves false where there was nothing.
 */
export function formChanged(original: object = {}, edited: object = {}): boolean {
  return [...new Set([...Object.keys(original), ...Object.keys(edited)])].some((field) => {
    const before = original[field];
    const after = edited[field];
    return !(isEmpty(before) && isEmpty(after)) && JSON.stringify(before) !== JSON.stringify(after);
  });
}

/**
 * Asks before leaving. A native dialog rather than Material's, because invited speakers' pages don't
 * load the Material theme, and rather than confirm() so the buttons can say what they do. Keeping
 * the edits is the default, so Escape or a stray Enter never loses them.
 */
@Component({
  template: `
    <dialog
      #dialog
      aria-labelledby="unsaved-title"
      aria-describedby="unsaved-description"
      (close)="answer(false)"
    >
      <h2 id="unsaved-title">Leave without saving?</h2>
      <p id="unsaved-description">
        You have changes on this page that haven't been saved. If you leave now, they'll be lost.
      </p>
      <div class="actions">
        <button type="button" class="leave" (click)="answer(true)">Leave without saving</button>
        <button type="button" autofocus (click)="answer(false)">Keep editing</button>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      margin: auto;
      max-width: min(440px, calc(100vw - 32px));
      box-sizing: border-box;
      padding: 24px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-bg);
      color: var(--color-text);
      text-align: left;
    }
    dialog::backdrop {
      background: rgb(0 0 0 / 50%);
    }
    h2 {
      margin: 0 0 8px;
      font-size: 1.25rem;
    }
    p {
      margin: 0 0 24px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      margin: 0;
    }
    .leave {
      background: transparent;
      color: var(--color-text);
      border: 1px solid var(--color-border);
    }
  `,
})
class UnsavedChangesDialogComponent {
  private dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  /** Records the visitor's choice. Only the first call counts, and Escape arrives as `close`. */
  answer: (leave: boolean) => void = () => undefined;

  /** Resolves to whether the visitor chose to leave. */
  ask() {
    return new Promise<boolean>((resolve) => {
      this.answer = resolve;
      this.dialog().nativeElement.showModal();
    });
  }
}

/** The question on screen, so a second navigation (say, Back again) shares it instead of stacking. */
let question: Promise<boolean> | undefined;

/** Route guard for in-app navigation. Closing or reloading the tab is `warnOnPageUnload`'s job. */
export const confirmLeavingUnsaved: CanDeactivateFn<UnsavedChangesForm> = (form) => {
  if (!form.hasUnsavedChanges()) return true;
  if (question) return question;
  const appRef = inject(ApplicationRef);
  const dialog = createComponent(UnsavedChangesDialogComponent, {
    environmentInjector: inject(EnvironmentInjector),
  });
  appRef.attachView(dialog.hostView);
  document.body.append(dialog.location.nativeElement);
  dialog.changeDetectorRef.detectChanges();
  question = dialog.instance.ask().finally(() => {
    question = undefined;
    dialog.destroy();
  });
  return question;
};

/**
 * Has the browser ask before the tab is closed, reloaded or sent to another site. Browsers show
 * their own wording here and don't allow custom text. Call from the page's constructor.
 */
export function warnOnPageUnload(form: UnsavedChangesForm) {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
  const warn = (event: BeforeUnloadEvent) => {
    if (form.hasUnsavedChanges()) event.preventDefault();
  };
  window.addEventListener('beforeunload', warn);
  inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', warn));
}
