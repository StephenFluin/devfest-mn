import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { push, ref, serverTimestamp, update } from 'firebase/database';

import { environment } from '../../environments/environment';
import { DataService, Session } from '../shared/data.service';

interface RoomDraft {
  /** The room's database key; new rooms get one up front so they can be referred to. */
  key: string;
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
          The schedule's columns, in this order. Directions show on the home page and on each
          session in the room. Renaming a room moves its sessions too.
        </p>
      </div>
      <button mat-stroked-button type="button" (click)="add()">Add room</button>
    </div>
    @if (!ds.roomsSaved()) {
      <p class="notice">
        These are the defaults from <code>environment.ts</code>. Save to start managing rooms here.
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
                  <mat-hint
                    >{{ sessionLabel(sessionCount(room.name.trim()))
                    }}{{ incomingLabel(room.key) }}</mat-hint
                  >
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
            @if (confirmingRemove() === room.key && room.originalName) {
              <div class="notice warn confirm" role="alert">
                <p>
                  <strong>{{ room.originalName }}</strong> still has
                  {{ sessionLabel(sessionCount(room.originalName)) }}:
                </p>
                <ul>
                  @for (session of sessionsIn(room.originalName); track session.$key) {
                    <li>
                      <a [routerLink]="['../sessions', session.$key, 'edit']">{{
                        session.title || 'Untitled session'
                      }}</a>
                      @if (session.startTime) {
                        <span class="muted"> · {{ session.startTime }}</span>
                      }
                      @if (!session.published) {
                        <span class="muted"> · unpublished</span>
                      }
                    </li>
                  }
                </ul>
                @if (otherRooms(room.key).length) {
                  <div class="move">
                    <mat-form-field subscriptSizing="dynamic">
                      <mat-label>Move them to</mat-label>
                      <mat-select [(value)]="moveTarget">
                        @for (other of otherRooms(room.key); track other.key) {
                          <mat-option [value]="other.key">{{ other.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button
                      mat-flat-button
                      type="button"
                      [disabled]="!moveTarget"
                      (click)="removeRoom(i, moveTarget)"
                    >
                      Move and remove room
                    </button>
                  </div>
                }
                <p class="muted">
                  Or remove the room and leave them be: they'll keep "{{ room.originalName }}" as
                  their room and still show in a column of their own on the schedule.
                </p>
                <div class="row-actions">
                  <button mat-button class="danger" type="button" (click)="removeRoom(i, null)">
                    Remove room, keep sessions there
                  </button>
                  <button mat-button type="button" (click)="confirmingRemove.set(null)">
                    Cancel
                  </button>
                </div>
              </div>
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
        <button mat-button type="button" (click)="discard()">Discard changes</button>
        <span
          class="status"
          [class.error]="problem() || failed()"
          [class.ok]="!problem() && !failed() && status()"
          role="status"
        >
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
    .confirm ul {
      margin: 0 0 12px;
      padding-left: 20px;
    }
    .confirm .move {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
  `,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TextFieldModule,
  ],
})
export class RoomsComponent {
  ds = inject(DataService);

  /** The rooms as currently saved, as drafts. */
  loaded = computed<RoomDraft[]>(() =>
    this.ds.rooms().map((room) => ({
      key: room.$key ?? push(this.ds.ref('rooms')).key,
      originalName: room.name,
      name: room.name,
      directions: room.directions ?? '',
    })),
  );

  /** Edits in progress; reset whenever the saved rooms change. */
  draft = linkedSignal(() => this.loaded());

  saving = signal(false);
  status = signal('');
  failed = signal(false);
  /** Key of the room in use whose Remove is waiting on what to do with its sessions. */
  confirmingRemove = signal<string | null>(null);
  /** The room picked in that confirmation to move the sessions to. */
  moveTarget: string | null = null;
  /** Sessions to move when saving: the removed room's name, to the key of the room they go to. */
  reassign = linkedSignal<RoomDraft[], Record<string, string>>({
    source: () => this.loaded(),
    computation: () => ({}),
  });

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

  sessionsIn(name: string) {
    return this.ds
      .schedule()
      .filter((session) => session.room === name)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }

  /** Rooms the sessions of the room with this key could move to. */
  otherRooms(key: string) {
    return this.draft().filter((room) => room.key !== key && room.name.trim());
  }

  /** e.g. ", plus 2 moving from Lunch Room", for a room that removed rooms' sessions move to. */
  incomingLabel(key: string) {
    const from = Object.entries(this.reassign()).filter(([, to]) => to === key);
    if (!from.length) return '';
    const count = from.reduce((sum, [name]) => sum + this.sessionCount(name), 0);
    return `, plus ${count} moving from ${from.map(([name]) => name).join(', ')}`;
  }

  /** Rooms sessions use that aren't in the list (e.g. saved before rooms were managed here). */
  unlisted = computed(() => {
    const listed = new Set([
      ...this.draft().flatMap((room) => [room.name.trim(), room.originalName]),
      ...Object.keys(this.reassign()),
    ]);
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
    this.draft.update((rooms) =>
      rooms.map((room, i) => (i === index ? { ...room, ...change } : room)),
    );
  }

  move(index: number, by: number) {
    this.draft.update((rooms) => {
      const next = [...rooms];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
  }

  add(name = '') {
    const key = push(this.ds.ref('rooms')).key;
    this.draft.update((rooms) => [...rooms, { key, name, directions: '' }]);
  }

  discard() {
    this.draft.set(this.loaded());
    this.reassign.set({});
    this.confirmingRemove.set(null);
  }

  /**
   * Removes a room. A room with sessions in it first asks what to do with them: pass `moveTo`
   * (another room's key) to move them there on save, or null to leave them in the old room.
   */
  removeRoom(index: number, moveTo?: string | null) {
    const room = this.draft()[index];
    const name = room.originalName;
    if (name && this.sessionCount(name) && moveTo === undefined) {
      this.moveTarget = null;
      this.confirmingRemove.set(room.key);
      return;
    }
    this.confirmingRemove.set(null);
    if (name && moveTo) this.reassign.update((moves) => ({ ...moves, [name]: moveTo }));
    // Sessions headed to this room now stay where they are.
    this.reassign.update((moves) =>
      Object.fromEntries(Object.entries(moves).filter(([, to]) => to !== room.key)),
    );
    this.draft.update((rooms) => rooms.filter((_, i) => i !== index));
  }

  /** Saves every room, removes deleted ones, and moves sessions in renamed rooms, all at once. */
  async save(event: Event) {
    event.preventDefault();
    if (this.problem()) return;
    const updates: Record<string, unknown> = {};
    const kept = new Set<string>();
    /** Sessions moved by a rename or a removal, as they were, with the room they're going to. */
    const moved: { session: Session; room: string }[] = [];
    this.draft().forEach((room, order) => {
      const key = room.key;
      kept.add(key);
      const name = room.name.trim();
      updates[`rooms/${key}`] = { name, directions: room.directions.trim() || null, order };
      if (room.originalName && room.originalName !== name) {
        for (const session of this.ds.schedule()) {
          if (session.room === room.originalName) {
            updates[`schedule/${session.$key}/room`] = name;
            updates[`schedule/${session.$key}/updatedAt`] = serverTimestamp();
            moved.push({ session, room: name });
          }
        }
      }
    });
    for (const room of this.loaded()) {
      if (room.key && !kept.has(room.key)) updates[`rooms/${room.key}`] = null;
    }
    for (const [from, toKey] of Object.entries(this.reassign())) {
      const to = this.draft()
        .find((room) => room.key === toKey)
        ?.name.trim();
      if (!to) continue;
      for (const session of this.ds.schedule()) {
        if (session.room === from) {
          updates[`schedule/${session.$key}/room`] = to;
          updates[`schedule/${session.$key}/updatedAt`] = serverTimestamp();
          moved.push({ session, room: to });
        }
      }
    }

    this.saving.set(true);
    this.failed.set(false);
    try {
      await update(ref(this.ds.db, `devfest${environment.year}`), updates);
      this.status.set('Saved.');
      for (const { session, room } of moved) {
        void this.ds.recordEdit('schedule', session.$key, 'update', session, { room });
      }
    } catch (error) {
      console.error('Error saving rooms', error);
      this.failed.set(true);
      this.status.set(`Couldn't save: ${error.message ?? error}`);
    } finally {
      this.saving.set(false);
    }
  }
}
