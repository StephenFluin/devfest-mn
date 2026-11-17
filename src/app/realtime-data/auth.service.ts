import {
  Injectable,
  inject,
  signal,
  computed,
  Signal,
  DestroyRef,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
// Types only: firebase/auth itself is loaded on demand (see loadAuth), so most visitors never download it.
import type { Auth, User } from 'firebase/auth';
import { get, ref, serverTimestamp, set } from 'firebase/database';

import { DATABASE, FIREBASE_APP, objectResource } from './firebase';
import { environment } from '../../environments/environment';

/** Set in localStorage while someone is signed in with Google, so the next visit loads auth. */
const SIGNED_IN_HINT = 'authentication';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private app = inject(FIREBASE_APP);
  db = inject(DATABASE);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private destroyRef = inject(DestroyRef);

  /** firebase/auth and this app's Auth instance, once something has asked for them. */
  private authModule?: Promise<{ auth: Auth; sdk: typeof import('firebase/auth') }>;
  /** The loaded Auth instance, so a click can open the sign-in popup without awaiting a download. */
  private loaded: { auth: Auth; sdk: typeof import('firebase/auth') } | null = null;

  /**
   * `undefined` while finding out who is signed in; `null` when no one is, during SSR, and for
   * visitors who haven't signed in on this browser (auth isn't loaded for them at all).
   */
  private user = signal<User | null | undefined>(this.isBrowser && readHint() ? undefined : null);

  uid: Signal<string | null> = computed(() => this.user()?.uid);
  email: Signal<string | null> = computed(() => this.user()?.email ?? null);
  name: Signal<string | null> = computed(
    () => this.user()?.displayName || this.user()?.providerData[0]?.displayName,
  );

  /** admin/<uid>: `true` for admins added before email invites, or { email, name, claimedAt }. */
  private adminRecord = objectResource<unknown>(
    () => (this.uid() ? ref(this.db, `/admin/${this.uid()}`) : undefined),
    { initialValue: null },
  );
  isAdmin = computed(() => !!this.adminRecord());

  /** The signed-in user's admin invite claim, so the route guard can wait for it. */
  private claim: Promise<void> = Promise.resolve();

  constructor() {
    if (this.isBrowser && readHint()) {
      void this.loadAuth();
    }
  }

  /**
   * Loads firebase/auth (once) and starts following who is signed in. Resolves to `null` during
   * SSR, where there is never a signed-in user. Call it before anything that needs auth.
   */
  async loadAuth(): Promise<Auth | null> {
    if (!this.isBrowser) {
      return null;
    }
    this.authModule ??= import('firebase/auth').then((sdk) => {
      const auth = sdk.getAuth(this.app);
      const unsubscribe = sdk.onAuthStateChanged(auth, (user) => {
        this.claim = user ? this.claimInvites(user) : Promise.resolve();
        writeHint(!!user && !user.isAnonymous);
        this.user.set(user);
      });
      this.destroyRef.onDestroy(unsubscribe);
      this.loaded = { auth, sdk };
      return this.loaded;
    });
    return (await this.authModule).auth;
  }

  /** Starts downloading auth ahead of a likely sign-in click, so the popup isn't blocked. */
  preload() {
    void this.loadAuth();
  }

  /** The signed-in user's Firebase ID token, for calling the app's own server endpoints. */
  async idToken(): Promise<string | undefined> {
    return (await this.loadAuth())?.currentUser?.getIdToken();
  }

  /**
   * Whoever is signed in once the initial auth state is known, including a speaker's anonymous
   * sign-in from their edit link. Null when no one is.
   */
  async currentUser(): Promise<User | null> {
    const auth = await this.loadAuth();
    await auth?.authStateReady();
    return auth?.currentUser ?? null;
  }

  /** Waits for the initial auth state, then checks /admin once. Used by the admin route guard. */
  async checkAdmin(): Promise<boolean> {
    const auth = await this.loadAuth();
    if (!auth) {
      return false;
    }
    await auth.authStateReady();
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return false;
    }
    await this.claim;
    try {
      return (await get(ref(this.db, `/admin/${uid}`))).exists();
    } catch {
      return false;
    }
  }

  /**
   * Admins and volunteers are invited by email (/admin/admins, /admin/volunteers). When someone
   * signs in with an invited, Google-verified email, this records them under their uid, which is
   * what the database rules check. The rules only allow it for an invite matching the sign-in.
   */
  private async claimInvites(user: User) {
    if (!user.email || !user.emailVerified) return;
    await Promise.all(
      INVITES.map(async ({ invites, records }) => {
        try {
          const invite = await get(ref(this.db, `${invites}/${inviteKey(user.email)}`));
          if (!invite.exists()) return;
          await set(ref(this.db, `${records}/${user.uid}`), {
            email: user.email,
            name: user.displayName ?? null,
            claimedAt: serverTimestamp(),
          });
        } catch (error) {
          console.error(`Could not accept invite at ${invites}`, error);
        }
      }),
    );
  }

  /**
   * Where a Login tap stands when auth wasn't downloaded yet: `loading` while it downloads, then
   * `confirm` if the download took long enough that the browser blocked the sign-in popup (it only
   * allows one right after a tap). Login buttons show this, so the next tap opens the popup at once.
   */
  signInStep = signal<'idle' | 'loading' | 'confirm'>('idle');

  /**
   * Signs in with Google in a popup. Resolves to true once signed in, or false when the popup has to
   * wait for another tap (see signInStep).
   */
  async login(): Promise<boolean> {
    if (!this.isBrowser) {
      console.warn('Login attempted in SSR context');
      return false;
    }
    // Browsers only allow the popup straight from a tap. If auth is already loaded (preload(), or a
    // previous tap), open it without awaiting anything; otherwise capture this tap, download auth,
    // and try anyway, since most browsers still allow a popup for a few seconds after the tap.
    const firstTap = !this.loaded;
    if (firstTap) {
      this.signInStep.set('loading');
      try {
        await this.loadAuth();
      } catch (error) {
        this.signInStep.set('idle');
        throw error;
      }
    }
    const { auth, sdk } = this.loaded;
    try {
      await sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider());
    } catch (error) {
      if (firstTap && error?.code === 'auth/popup-blocked') {
        this.signInStep.set('confirm');
        return false;
      }
      this.signInStep.set('idle');
      throw error;
    }
    this.signInStep.set('idle');
    writeHint(true);
    return true;
  }

  async logout() {
    if (!this.isBrowser) {
      console.warn('Logout attempted in SSR context');
      return;
    }
    writeHint(false);
    await (await this.loadAuth())?.signOut();
  }
}

function readHint(): boolean {
  try {
    return !!window.localStorage.getItem(SIGNED_IN_HINT);
  } catch {
    return false;
  }
}

function writeHint(signedIn: boolean) {
  try {
    if (signedIn) {
      window.localStorage.setItem(SIGNED_IN_HINT, 'active');
    } else {
      window.localStorage.removeItem(SIGNED_IN_HINT);
    }
  } catch {
    // Storage blocked: auth will just load on demand each visit.
  }
}

/** Where invites are kept, and where someone is recorded once they accept by signing in. */
export const INVITES = [
  { invites: 'adminEmails', records: 'admin' },
  {
    invites: `devfest${environment.year}/volunteerEmails`,
    records: `devfest${environment.year}/volunteers`,
  },
];

/** Invite key for an email: lowercase, with dots (not allowed in keys) as commas. */
export function inviteKey(email: string) {
  return email.trim().toLowerCase().replace(/\./g, ',');
}
