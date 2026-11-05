import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-speaker-management',
  template: `
    <div class="management" aria-labelledby="management-title">
      <div class="heading">
        <div>
          <h2 id="management-title">Manage speakers</h2>
          <p aria-live="polite">{{ visible() }} of {{ total() }} speakers</p>
        </div>
        <div class="actions">
          <button type="button" class="add" (click)="addSpeaker.emit()">Add speaker</button>
          <button
            type="button"
            [attr.aria-expanded]="inviteOpen()"
            aria-controls="invite-speaker-form"
            (click)="toggleInvite.emit()"
          >
            Invite speaker
          </button>
        </div>
      </div>
      <div class="controls">
        <div class="filters" role="group" aria-label="Filter speakers by publication">
          <button
            type="button"
            [attr.aria-pressed]="publication() === 'all'"
            (click)="publicationChange.emit('all')"
          >
            All <span>{{ total() }}</span>
          </button>
          <button
            type="button"
            [attr.aria-pressed]="publication() === 'published'"
            (click)="publicationChange.emit('published')"
          >
            Published <span>{{ published() }}</span>
          </button>
          <button
            type="button"
            [attr.aria-pressed]="publication() === 'unpublished'"
            (click)="publicationChange.emit('unpublished')"
          >
            Unpublished <span>{{ total() - published() }}</span>
          </button>
        </div>
        <div class="views" role="group" aria-label="Speaker view">
          <button
            type="button"
            [attr.aria-pressed]="view() === 'tiles'"
            (click)="viewChange.emit('tiles')"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 2h4v4H2zm8 0h4v4h-4zM2 10h4v4H2zm8 0h4v4h-4z" />
            </svg>
            Tiles
          </button>
          <button
            type="button"
            [attr.aria-pressed]="view() === 'table'"
            (click)="viewChange.emit('table')"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 3h12M2 8h12M2 13h12M5 3v10" />
            </svg>
            Table
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './speaker-management.component.css',
})
export class SpeakerManagementComponent {
  total = input.required<number>();
  published = input.required<number>();
  visible = input.required<number>();
  view = input.required<'tiles' | 'table'>();
  publication = input.required<'all' | 'published' | 'unpublished'>();
  inviteOpen = input(false);
  viewChange = output<'tiles' | 'table'>();
  publicationChange = output<'all' | 'published' | 'unpublished'>();
  addSpeaker = output<void>();
  toggleInvite = output<void>();
}
