import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
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
        <div class="page-header">
            <div>
                <h2>Rooms</h2>
                <p class="muted">
                    The schedule's columns, in this order. Directions show on the home page and on
                    each session in the room. Renaming a room moves its sessions too.
                </p>
            </div>
            <button mat-stroked-button type="button" (click)="add()">Add room</button>
        </div>
        @if (!ds.roomsSaved()) {
        <p class="notice">
            These are the defaults from <code>environment.ts</code>. Save to start managing rooms
            here.
        </p>
        }

        <form (submit)="save($event)" autocomplete="off">
            <ol class="rooms">
                @for (room of draft(); track $index; let i = $index, first = $first, last = $last) {
                <li class="card room" [attr.aria-label]="room.name || 'New room'">
                    <span class="order" aria-hidden="true">{{ i + 1 }}</span>
                    <div class="field-grid">
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
                                {{ sessionLabel(sessionCount(room.originalName)) }}</mat-hint
                            >
                            } @else {
                            <mat-hint>{{ sessionLabel(sessionCount(room.name.trim())) }}</mat-hint>
                            }
                        </mat-form-field>
                        <mat-form-field>
                            <mat-label>Directions</mat-label>
                            <textarea
                                matInput
                                [ngModel]="room.directions"
                                (ngModelChange)="edit(i, { directions: $event })"
                                [name]="'directions' + i"
                                maxlength="500"
                                cdkTextareaAutosize
                                cdkAutosizeMinRows="1"
                                placeholder="e.g. Down the hallway from the Auditorium."
                            ></textarea>
                        </mat-form-field>
                    </div>
                    <div class="row-actions">
                        <button
                            mat-button
                            type="button"
                            (click)="move(i, -1)"
                            [disabled]="first"
                            [attr.aria-label]="'Move ' + (room.name || 'room') + ' up'"
                        >
                            ↑ Up
                        </button>
                        <button
                            mat-button
                            type="button"
                            (click)="move(i, 1)"
                            [disabled]="last"
                            [attr.aria-label]="'Move ' + (room.name || 'room') + ' down'"
                        >
                            ↓ Down
                        </button>
                        <button
                            mat-button
                            class="danger"
                            type="button"
                            (click)="removeRoom(i)"
                            [attr.aria-label]="'Remove ' + (room.name || 'room')"
                        >
                            Remove
                        </button>
                    </div>
                    @if (room.originalName && sessionCount(room.originalName) && removedWarning() === i) {
                    <p class="notice warn" role="alert">
                        {{ sessionLabel(sessionCount(room.originalName)) }} in this room keep it and
                        show in their own column until you move them. Click Remove again to remove
                        it anyway.
                    </p>
                    }
                </li>
                }
            </ol>

            @if (unlisted().length) {
            <div class="notice">
                <p>Sessions also use these rooms, which aren't listed:</p>
                <div class="actions">
                    @for (name of unlisted(); track name) {
                    <button mat-stroked-button type="button" (click)="add(name)">Add "{{ name }}"</button>
                    }
                </div>
            </div>
            }

            <div class="actions sticky">
                <button mat-flat-button type="submit" [disabled]="!!problem() || saving()">
                    {{ saving() ? 'Saving…' : 'Save rooms' }}
                </button>
                <button mat-button type="button" (click)="draft.set(loaded())">Discard changes</button>
                <span class="status" [class.error]="problem() || failed()" [class.ok]="!problem() && !failed() && status()" role="status">
                    {{ problem() || status() }}
                </span>
            </div>
        </form>
    `,
    styles: `
        .rooms {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .room {
            position: relative;
            padding-left: 64px;
            margin-bottom: 16px;
        }
        .order {
            position: absolute;
            left: 20px;
            top: 28px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            font: var(--mat-sys-label-large);
            background: var(--mat-sys-primary-container);
            color: var(--mat-sys-on-primary-container);
        }
        .row-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 4px;
        }
        .notice p {
            margin-bottom: 8px;
        }
    `,
    imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, TextFieldModule],
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
    failed = signal(false);
    /** Index of a room in use that Remove was clicked on once. */
    removedWarning = signal<number | null>(null);

    private sessionsPerRoom = computed(() => {
        const counts = new Map<string, number>();
        for (const session of this.ds.schedule()) {
            if (session.room) counts.set(session.room, (counts.get(session.room) ?? 0) + 1);
        }
        return counts;
    });

    sessionLabel(count: number) {
        return count === 1 ? '1 session' : `${count} sessions`;
    }

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
        this.failed.set(false);
        try {
            await update(ref(this.ds.db, `devfest${environment.year}`), updates);
            this.status.set('Saved.');
        } catch (error) {
            console.error('Error saving rooms', error);
            this.failed.set(true);
            this.status.set(`Couldn't save: ${error.message ?? error}`);
        } finally {
            this.saving.set(false);
        }
    }
}
