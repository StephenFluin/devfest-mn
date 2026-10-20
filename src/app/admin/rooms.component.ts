import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { push, ref, serverTimestamp, update } from 'firebase/database';

import { environment } from '../../environments/environment';
import { DataService } from '../shared/data.service';

interface RoomDraft {
    key?: string;
    /** The name when loaded, so a rename can follow through to the sessions in that room. */
    originalName?: string;
    name: string;
    directions: string;
}

/**
 * Edit the event's rooms: their names, directions from registration, and schedule column order.
 * Everything is saved together in one update, so renaming a room also moves every session in it.
 */
@Component({
    template: `
        <h2>Rooms</h2>
        <p>
            Rooms are the schedule's columns, in this order, and their directions show on the home
            page and on each session in the room. Renaming a room moves its sessions too.
        </p>
        @if (!ds.roomsSaved()) {
        <p class="note">
            These are the defaults from <code>environment.ts</code>. Save to start managing rooms
            here.
        </p>
        }

        <form (submit)="save($event)" autocomplete="off">
            @for (room of draft(); track $index; let i = $index, first = $first, last = $last) {
            <fieldset class="room">
                <legend>{{ room.name || 'New room' }}</legend>
                <mat-form-field>
                    <mat-label>Name</mat-label>
                    <input
                        matInput
                        [ngModel]="room.name"
                        (ngModelChange)="edit(i, { name: $event })"
                        [name]="'name' + i"
                        required
                        maxlength="80"
                    />
                    @if (room.originalName && room.name.trim() !== room.originalName) {
                    <mat-hint
                        >Renamed from "{{ room.originalName }}"; moves
                        {{ sessionCount(room.originalName) }} session(s)</mat-hint
                    >
                    } @else {
                    <mat-hint>{{ sessionCount(room.name.trim()) }} session(s)</mat-hint>
                    }
                </mat-form-field>
                <mat-form-field class="directions">
                    <mat-label>Directions</mat-label>
                    <textarea
                        matInput
                        [ngModel]="room.directions"
                        (ngModelChange)="edit(i, { directions: $event })"
                        [name]="'directions' + i"
                        maxlength="500"
                        rows="2"
                        placeholder="e.g. Down the hallway from the Auditorium."
                    ></textarea>
                </mat-form-field>
                <div class="row-actions">
                    <button mat-button type="button" (click)="move(i, -1)" [disabled]="first">
                        Move up
                    </button>
                    <button mat-button type="button" (click)="move(i, 1)" [disabled]="last">
                        Move down
                    </button>
                    <button mat-button type="button" (click)="removeRoom(i)">Remove</button>
                </div>
                @if (room.originalName && sessionCount(room.originalName) && removedWarning() === i) {
                <p class="warning">
                    {{ sessionCount(room.originalName) }} session(s) are in this room. They keep it
                    and show in their own column until you move them. Click Remove again to remove
                    it anyway.
                </p>
                }
            </fieldset>
            }

            @if (unlisted().length) {
            <p>
                Sessions also use these rooms, which aren't listed:
                @for (name of unlisted(); track name) {
                <button mat-stroked-button type="button" (click)="add(name)">Add "{{ name }}"</button>
                }
            </p>
            }

            <div class="form-actions">
                <button mat-stroked-button type="button" (click)="add()">Add room</button>
                <button mat-flat-button type="submit" [disabled]="!!problem() || saving()">
                    {{ saving() ? 'Saving…' : 'Save rooms' }}
                </button>
                <button mat-button type="button" (click)="draft.set(loaded())">Discard changes</button>
                @if (problem(); as problem) {
                <span class="warning">{{ problem }}</span>
                } @else if (status(); as status) {
                <span>{{ status }}</span>
                }
            </div>
        </form>
        <p><a routerLink="/schedule">View the schedule</a></p>
    `,
    styles: `
        .room {
            border: 1px solid #ccc;
            border-radius: 8px;
            margin: 16px 0;
            padding: 8px 16px;
        }
        mat-form-field {
            display: block;
            max-width: 600px;
        }
        .row-actions,
        .form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .note {
            background: #fff8e1;
            padding: 8px 12px;
        }
        .warning {
            color: #b00020;
        }
    `,
    imports: [FormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class RoomsComponent {
    ds = inject(DataService);

    /** The rooms as currently saved, as drafts. */
    loaded = computed<RoomDraft[]>(() =>
        this.ds.rooms().map((room) => ({
            key: room.$key,
            originalName: room.name,
            name: room.name,
            directions: room.directions ?? '',
        }))
    );

    /** Edits in progress; reset whenever the saved rooms change. */
    draft = linkedSignal(() => this.loaded());

    saving = signal(false);
    status = signal('');
    /** Index of a room in use that Remove was clicked on once. */
    removedWarning = signal<number | null>(null);

    private sessionsPerRoom = computed(() => {
        const counts = new Map<string, number>();
        for (const session of this.ds.schedule()) {
            if (session.room) counts.set(session.room, (counts.get(session.room) ?? 0) + 1);
        }
        return counts;
    });

    sessionCount(name: string) {
        return this.sessionsPerRoom().get(name) ?? 0;
    }

    /** Rooms sessions use that aren't in the list (e.g. saved before rooms were managed here). */
    unlisted = computed(() => {
        const listed = new Set(this.draft().flatMap((room) => [room.name.trim(), room.originalName]));
        return [...this.sessionsPerRoom().keys()].filter((name) => !listed.has(name));
    });

    /** Why the rooms can't be saved, if they can't. */
    problem = computed(() => {
        const names = this.draft().map((room) => room.name.trim().toLowerCase());
        if (names.some((name) => !name)) return 'Every room needs a name.';
        if (new Set(names).size !== names.length) return 'Two rooms have the same name.';
        return '';
    });

    edit(index: number, change: Partial<RoomDraft>) {
        this.status.set('');
        this.draft.update((rooms) => rooms.map((room, i) => (i === index ? { ...room, ...change } : room)));
    }

    move(index: number, by: number) {
        this.draft.update((rooms) => {
            const next = [...rooms];
            [next[index], next[index + by]] = [next[index + by], next[index]];
            return next;
        });
    }

    add(name = '') {
        this.draft.update((rooms) => [...rooms, { name, directions: '' }]);
    }

    removeRoom(index: number) {
        const room = this.draft()[index];
        if (room.originalName && this.sessionCount(room.originalName) && this.removedWarning() !== index) {
            this.removedWarning.set(index);
            return;
        }
        this.removedWarning.set(null);
        this.draft.update((rooms) => rooms.filter((_, i) => i !== index));
    }

    /** Saves every room, removes deleted ones, and moves sessions in renamed rooms, all at once. */
    async save(event: Event) {
        event.preventDefault();
        if (this.problem()) return;
        const updates: Record<string, unknown> = {};
        const kept = new Set<string>();
        this.draft().forEach((room, order) => {
            const key = room.key ?? push(this.ds.ref('rooms')).key;
            kept.add(key);
            const name = room.name.trim();
            updates[`rooms/${key}`] = { name, directions: room.directions.trim() || null, order };
            if (room.originalName && room.originalName !== name) {
                for (const session of this.ds.schedule()) {
                    if (session.room === room.originalName) {
                        updates[`schedule/${session.$key}/room`] = name;
                        updates[`schedule/${session.$key}/updatedAt`] = serverTimestamp();
                    }
                }
            }
        });
        for (const room of this.loaded()) {
            if (room.key && !kept.has(room.key)) updates[`rooms/${room.key}`] = null;
        }

        this.saving.set(true);
        try {
            await update(ref(this.ds.db, `devfest${environment.year}`), updates);
            this.status.set('Saved.');
        } catch (error) {
            console.error('Error saving rooms', error);
            this.status.set(`Couldn't save: ${error.message ?? error}`);
        } finally {
            this.saving.set(false);
        }
    }
}
