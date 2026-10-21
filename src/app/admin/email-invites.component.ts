import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ref, serverTimestamp, update } from 'firebase/database';

import { AuthService, inviteKey } from '../realtime-data/auth.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';

interface Invite {
  email: string;
  name?: string;
  addedBy?: string;
  addedAt?: number;
}

/** <records>/<uid>: `true` for people added by user ID before email invites, otherwise who claimed it. */
type Record_ = true | { email?: string; name?: string; claimedAt?: number };

interface Row {
  /** Invite key, for people invited by email. */
  key?: string;
  email?: string;
  name?: string;
  addedBy?: string;
  addedAt?: number;
  /** uids that have signed in with this invite. */
  uids: string[];
  isYou: boolean;
}

/**
 * People invited by email, for the Admins and Volunteers pages. Someone invited gets access the
 * next time they sign in with that Google account (AuthService.claimInvites). Removing someone
 * removes their invite and their record together.
 */
@Component({
  selector: 'app-email-invites',
  template: `
    <form class="card add" (submit)="add($event)" autocomplete="off">
      <mat-form-field>
        <mat-label>Email</mat-label>
        <input
          matInput
          type="email"
          name="email"
          [(ngModel)]="email"
          required
          spellcheck="false"
          autocapitalize="off"
        />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Name (optional)</mat-label>
        <input matInput name="name" [(ngModel)]="name" maxlength="100" />
      </mat-form-field>
      <button mat-flat-button type="submit" [disabled]="!validEmail() || busy()">
        Add {{ noun() }}
      </button>
    </form>
    @if (message()) {
      <p class="status" [class.error]="failed()" [class.ok]="!failed()" role="status">
        {{ message() }}
      </p>
    }

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th scope="col" class="text">{{ noun() | titlecase }}</th>
            <th scope="col" class="text">Status</th>
            <th scope="col" class="text">Added</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key ?? row.uids[0]) {
            <tr>
              <td class="text">
                <strong>{{ row.name || row.email || 'Added by user ID' }}</strong>
                @if (row.isYou) {
                  <span class="you">You</span>
                }
                <div class="muted">
                  {{ row.name ? row.email : '' }}{{ !row.email ? row.uids[0] : '' }}
                </div>
              </td>
              <td class="text">
                @if (row.uids.length) {
                  <span class="badge active">Active</span>
                } @else {
                  <span class="badge">Invited</span>
                  <div class="muted">Gets access at next sign-in</div>
                }
              </td>
              <td class="text">
                @if (row.addedAt) {
                  {{ row.addedAt | date: 'MMM d, y' }}
                }
                @if (row.addedBy) {
                  <div class="muted">by {{ row.addedBy }}</div>
                }
              </td>
              <td>
                <button
                  mat-button
                  class="danger"
                  type="button"
                  (click)="remove(row)"
                  [disabled]="(protectSelf() && row.isYou) || busy()"
                  [attr.aria-label]="'Remove ' + (row.email || 'this ' + noun())"
                  [title]="protectSelf() && row.isYou ? 'You can’t remove yourself' : ''"
                >
                  Remove
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .add {
      display: grid;
      grid-template-columns: minmax(220px, 2fr) minmax(160px, 1fr) auto;
      gap: 0 16px;
      align-items: baseline;
    }
    @media (max-width: 720px) {
      .add {
        grid-template-columns: 1fr;
      }
    }
    .you {
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 999px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }
    .badge.active {
      background: color-mix(in srgb, var(--admin-success) 18%, transparent);
      color: var(--admin-success);
    }
  `,
  imports: [
    DatePipe,
    TitleCasePipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class EmailInvitesComponent {
  private db = inject(DATABASE);
  private auth = inject(AuthService);

  /** Where invites are kept, e.g. adminEmails. */
  readonly invitesPath = input.required<string>();
  /** Where people are recorded by uid once they accept, e.g. admin. */
  readonly recordsPath = input.required<string>();
  /** "admin" or "volunteer", for labels. */
  readonly noun = input.required<string>();
  /** Whether people can't remove themselves (admins, so there's always one). */
  readonly protectSelf = input(false);

  private invites = objectResource<Record<string, Invite> | null>(
    () => ref(this.db, this.invitesPath()),
    { initialValue: null },
  );
  private records = objectResource<Record<string, Record_> | null>(
    () => ref(this.db, this.recordsPath()),
    { initialValue: null },
  );

  email = '';
  name = '';
  busy = signal(false);
  message = signal('');
  failed = signal(false);

  validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());

  /** Invited emails, with whoever has signed in for each, then people added by user ID. */
  rows = computed<Row[]>(() => {
    const you = this.auth.uid();
    const records = Object.entries(this.records() ?? {});
    const uidsFor = (email: string) =>
      records
        .filter(
          ([, record]) =>
            record !== true && record.email && inviteKey(record.email) === inviteKey(email),
        )
        .map(([uid]) => uid);
    const invited: Row[] = Object.entries(this.invites() ?? {}).map(([key, invite]) => {
      const uids = uidsFor(invite.email);
      return { key, ...invite, uids, isYou: !!you && uids.includes(you) };
    });
    const claimed = new Set(invited.flatMap((row) => row.uids));
    const others: Row[] = records
      .filter(([uid]) => !claimed.has(uid))
      .map(([uid, record]) => ({
        email: record === true ? undefined : record.email,
        name: record === true ? undefined : record.name,
        uids: [uid],
        isYou: uid === you,
      }));
    return [...invited, ...others].sort(
      (a, b) => Number(b.isYou) - Number(a.isYou) || (a.email ?? '~').localeCompare(b.email ?? '~'),
    );
  });

  async add(event: Event) {
    event.preventDefault();
    if (!this.validEmail()) return;
    const email = this.email.trim().toLowerCase();
    const me = this.auth.auth?.currentUser;
    await this.write(
      {
        [`${this.invitesPath()}/${inviteKey(email)}`]: {
          email,
          name: this.name.trim() || null,
          addedBy: me?.email ?? me?.displayName ?? null,
          addedAt: serverTimestamp(),
        },
      },
      `Added ${email}. They'll have access the next time they sign in.`,
    );
    if (!this.failed()) {
      this.email = '';
      this.name = '';
    }
  }

  async remove(row: Row) {
    if (this.protectSelf() && row.isYou) return;
    const who = row.email || `this ${this.noun()}`;
    if (
      !confirm(
        `Remove ${who} as a${/^[aeiou]/.test(this.noun()) ? 'n' : ''} ${this.noun()}? They'll lose access right away.`,
      )
    )
      return;
    const updates: Record<string, null> = {};
    if (row.key) updates[`${this.invitesPath()}/${row.key}`] = null;
    for (const uid of row.uids) updates[`${this.recordsPath()}/${uid}`] = null;
    await this.write(updates, `Removed ${who}.`);
  }

  private async write(updates: Record<string, unknown>, success: string) {
    this.busy.set(true);
    this.message.set('');
    try {
      await update(ref(this.db), updates);
      this.failed.set(false);
      this.message.set(success);
    } catch (error) {
      console.error(`Error updating ${this.noun()}s`, error);
      this.failed.set(true);
      this.message.set(`Couldn't save: ${error.message ?? error}`);
    } finally {
      this.busy.set(false);
    }
  }
}
