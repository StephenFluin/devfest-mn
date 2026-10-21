import { Injectable, inject, signal, computed, Signal, DestroyRef } from '@angular/core';
import { User, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { get, ref, serverTimestamp, set } from 'firebase/database';

import { AUTH, DATABASE, objectResource } from './firebase';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  auth = inject(AUTH);
  provider = new GoogleAuthProvider();
  db = inject(DATABASE);

  /** `undefined` until Firebase reports the initial auth state; always `null` during SSR. */
  private user = signal<User | null | undefined>(this.auth ? undefined : null);

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

  /** Waits for the initial auth state, then checks /admin once. Used by the admin route guard. */
  async checkAdmin(): Promise<boolean> {
    if (!this.auth) {
      return false;
    }
    await this.auth.authStateReady();
    const uid = this.auth.currentUser?.uid;
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

  constructor() {
    if (this.auth) {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        this.claim = user ? this.claimInvites(user) : Promise.resolve();
        this.user.set(user);
      });
      inject(DestroyRef).onDestroy(unsubscribe);
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

  login() {
    if (!this.auth) {
      console.warn('Login attempted in SSR context');
      return Promise.resolve(null);
    }

    return signInWithPopup(this.auth, this.provider).then((result) => {
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (window && window.localStorage) {
        window.localStorage['authentication'] = 'active';
      }
      return credential;
    });
  }
  logout() {
    if (!this.auth) {
      console.warn('Logout attempted in SSR context');
      return;
    }

    this.auth.signOut();
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
