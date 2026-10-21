import {
  afterNextRender,
  inject,
  makeStateKey,
  PLATFORM_ID,
  signal,
  Signal,
  TransferState,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';

/**
 * A value that depends on the current time, such as whether the CFP is open. The server works it out
 * when it renders the page and hands its answer to the browser, so hydration sees the page the
 * server sent. The browser then works it out from its own clock, which matters when the page was
 * prerendered at build time or the moment passed since. Must be called in an injection context.
 */
export function serverAgreedClock<T>(key: string, compute: () => T, fallback: T): Signal<T> {
  const transferState = inject(TransferState);
  const stateKey = makeStateKey<T>(key);
  const value = signal(fallback);
  if (isPlatformServer(inject(PLATFORM_ID))) {
    value.set(compute());
    transferState.set(stateKey, value());
  } else {
    value.set(transferState.get(stateKey, fallback));
    afterNextRender(() => value.set(compute()));
  }
  return value.asReadonly();
}
