import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { update } from 'firebase/database';

import { DataService } from '../shared/data.service';
import { objectResource } from '../realtime-data/firebase';

/** Volunteers can edit the schedule. They're added by their Firebase user ID. */
@Component({
    template: `
        <div class="page-header">
            <div>
                <h2>Volunteers</h2>
                <p class="muted">
                    Volunteers can edit sessions on the schedule. Ask them to sign in to the admin
                    once, then add the user ID it shows them.
                </p>
            </div>
        </div>

        <form class="card add" (submit)="add($event)">
            <mat-form-field>
                <mat-label>User ID</mat-label>
                <input matInput [(ngModel)]="id" name="id" autocomplete="off" spellcheck="false" />
            </mat-form-field>
            <button mat-flat-button type="submit" [disabled]="!id.trim()">Add volunteer</button>
        </form>

        @if (volunteerList().length) {
        <ul class="card list" aria-label="Volunteers">
            @for (volunteer of volunteerList(); track volunteer) {
            <li>
                <code>{{ volunteer }}</code>
                <button
                    mat-button
                    class="danger"
                    type="button"
                    (click)="remove(volunteer)"
                    [attr.aria-label]="'Remove volunteer ' + volunteer"
                >
                    Remove
                </button>
            </li>
            }
        </ul>
        } @else {
        <p class="muted">No volunteers yet.</p>
        }
        @if (error()) {
        <p class="status error" role="alert">{{ error() }}</p>
        }
    `,
    styles: `
        .add {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: baseline;
        }
        .add mat-form-field {
            flex: 1 1 320px;
        }
        .list {
            list-style: none;
            padding: 8px 24px;
        }
        .list li {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 8px 0;
        }
        .list li + li {
            border-top: 1px solid var(--mat-sys-outline-variant);
        }
    `,
    imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class VolunteersComponent {
    ds = inject(DataService);
    private volunteers = objectResource<Record<string, boolean>>(() => this.ds.ref('volunteers'), {
        initialValue: {},
    });
    volunteerList = computed(() => Object.keys(this.volunteers() ?? {}));
    id = '';
    error = signal('');

    add(event: Event) {
        event.preventDefault();
        const id = this.id.trim();
        if (!id) return;
        this.set(id, true);
        this.id = '';
    }

    remove(id: string) {
        if (confirm(`Remove volunteer ${id}?`)) this.set(id, null);
    }

    private set(id: string, state: true | null) {
        this.error.set('');
        update(this.ds.ref('volunteers'), { [id]: state }).catch((err) => {
            console.error('Error updating volunteers', err);
            this.error.set("Couldn't update volunteers.");
        });
    }
}
