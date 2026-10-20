import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ref, serverTimestamp, update } from 'firebase/database';

import { adminEmailKey, AuthService } from '../realtime-data/auth.service';
import { DATABASE, objectResource } from '../realtime-data/firebase';

interface Invite {
    email: string;
    name?: string;
    addedBy?: string;
    addedAt?: number;
}

/** admin/<uid>: `true` for admins added before email invites, otherwise who claimed it. */
type AdminRecord = true | { email?: string; name?: string; claimedAt?: number };

interface Row {
    /** adminEmails key, for invited admins. */
    key?: string;
    email?: string;
    name?: string;
    addedBy?: string;
    addedAt?: number;
    /** uids that have signed in as this admin. */
    uids: string[];
    isYou: boolean;
}

/**
 * Invite admins by email. Someone invited becomes an admin the next time they sign in with that
 * Google account (AuthService.claimAdminInvite). Removing an admin removes the invite and their
 * admin record. Nobody can remove themselves, so the admin can't be left without anyone.
 */
@Component({
    template: `
        <div class="page-header">
            <div>
                <h2>Admins</h2>
                <p class="muted">
                    Admins can see every page here and edit everything. Add someone by the email
                    address of their Google account; they get access the next time they sign in.
                </p>
            </div>
        </div>

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
            <button mat-flat-button type="submit" [disabled]="!validEmail() || busy()">Add admin</button>
        </form>
        @if (message()) {
        <p class="status" [class.error]="failed()" [class.ok]="!failed()" role="status">{{ message() }}</p>
        }

        <div class="table-wrap">
            <table class="data">
                <thead>
                    <tr>
                        <th scope="col" class="text">Admin</th>
                        <th scope="col" class="text">Status</th>
                        <th scope="col" class="text">Added</th>
                        <th scope="col"><span class="visually-hidden">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    @for (row of rows(); track row.key ?? row.uids[0]) {
                    <tr>
                        <td class="text">
                            <strong>{{ row.name || row.email || 'Admin added by user ID' }}</strong>
                            @if (row.isYou) {
                            <span class="you">You</span>
                            }
                            <div class="muted">{{ row.name ? row.email : '' }}{{ !row.email ? row.uids[0] : '' }}</div>
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
                                [disabled]="row.isYou || busy()"
                                [attr.aria-label]="'Remove ' + (row.email || 'this admin')"
                                [title]="row.isYou ? 'You can\\'t remove yourself' : ''"
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
    imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class AdminsComponent {
    private db = inject(DATABASE);
    private auth = inject(AuthService);

    private invites = objectResource<Record<string, Invite> | null>(() => ref(this.db, 'adminEmails'), {
        initialValue: null,
    });
    private records = objectResource<Record<string, AdminRecord> | null>(() => ref(this.db, 'admin'), {
        initialValue: null,
    });

    email = '';
    name = '';
    busy = signal(false);
    message = signal('');
    failed = signal(false);

    validEmail = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());

    /** Invited emails, with whoever has signed in for each, then admins added by user ID. */
    rows = computed<Row[]>(() => {
        const you = this.auth.uid();
        const records = Object.entries(this.records() ?? {});
        const uidsFor = (email: string) =>
            records
                .filter(([, record]) => record !== true && record.email && adminEmailKey(record.email) === adminEmailKey(email))
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
            (a, b) => Number(b.isYou) - Number(a.isYou) || (a.email ?? '~').localeCompare(b.email ?? '~')
        );
    });

    async add(event: Event) {
        event.preventDefault();
        if (!this.validEmail()) return;
        const email = this.email.trim().toLowerCase();
        const me = this.auth.auth?.currentUser;
        await this.write(
            {
                [`adminEmails/${adminEmailKey(email)}`]: {
                    email,
                    name: this.name.trim() || null,
                    addedBy: me?.email ?? me?.displayName ?? null,
                    addedAt: serverTimestamp(),
                },
            },
            `Added ${email}. They'll have access the next time they sign in.`
        );
        if (!this.failed()) {
            this.email = '';
            this.name = '';
        }
    }

    async remove(row: Row) {
        if (row.isYou) return;
        const who = row.email || 'this admin';
        if (!confirm(`Remove ${who} as an admin? They'll lose access right away.`)) return;
        const updates: Record<string, null> = {};
        if (row.key) updates[`adminEmails/${row.key}`] = null;
        for (const uid of row.uids) updates[`admin/${uid}`] = null;
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
            console.error('Error updating admins', error);
            this.failed.set(true);
            this.message.set(`Couldn't save: ${error.message ?? error}`);
        } finally {
            this.busy.set(false);
        }
    }
}
