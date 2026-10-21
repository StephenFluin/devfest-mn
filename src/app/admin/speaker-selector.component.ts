import { Component, computed, inject, input, signal } from '@angular/core';
import { ref, push } from 'firebase/database';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DataService, Session } from '../shared/data.service';
import { DATABASE } from '../realtime-data/firebase';
import { environment } from '../../environments/environment';

/** Search the speakers and add them to a saved session. */
@Component({
  selector: 'speaker-selector',
  template: `
    @if (session().$key) {
      <mat-form-field class="search">
        <mat-label>Add a speaker</mat-label>
        <input
          matInput
          type="search"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
          placeholder="Search by name or company"
        />
      </mat-form-field>
      <ul class="results" aria-label="Speakers you can add">
        @for (speaker of matches(); track speaker.$key) {
          <li>
            @if (speaker.imageUrl) {
              <img [src]="speaker.imageUrl" alt="" class="avatar" />
            } @else {
              <span class="avatar" aria-hidden="true">{{ speaker.name?.[0] ?? '?' }}</span>
            }
            <span class="who">
              <strong>{{ speaker.name }}</strong>
              <span class="muted"
                >{{ speaker.company }}{{ speaker.confirmed ? '' : ' · not confirmed' }}</span
              >
            </span>
            <button
              mat-stroked-button
              type="button"
              (click)="add(speaker.$key)"
              [attr.aria-label]="'Add ' + speaker.name + ' to this session'"
            >
              Add
            </button>
          </li>
        } @empty {
          <li class="muted">No speakers match.</li>
        }
      </ul>
    } @else {
      <p class="muted">Create the session first, then add its speakers.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .search {
      max-width: 420px;
    }
    .results {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    .results li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
    }
    .results li + li {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .who {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
  `,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
})
export class SpeakerSelectorComponent {
  private db = inject(DATABASE);
  private ds = inject(DataService);

  readonly session = input<Session>(undefined);
  search = signal('');

  /** Speakers not already in the session that match the search. */
  matches = computed(() => {
    const current = new Set(Object.values(this.session()?.speakers ?? {}));
    const text = this.search().trim().toLowerCase();
    return this.ds
      .speakers()
      .filter((speaker) => !current.has(speaker.$key))
      .filter(
        (speaker) =>
          !text ||
          speaker.name?.toLowerCase().includes(text) ||
          speaker.company?.toLowerCase().includes(text),
      );
  });

  add(speakerKey: string) {
    const path = `devfest${environment.year}/schedule/${this.session().$key}/speakers`;
    push(ref(this.db, path), speakerKey).catch((err) =>
      console.error('Error adding speaker to session', err),
    );
  }
}
