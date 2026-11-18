import { Component, computed, inject, input } from '@angular/core';
import { equalTo, orderByChild, query } from 'firebase/database';

import { listResource } from '../realtime-data/firebase';
import { DataService } from '../shared/data.service';
import { EditLogEntry, EditLogPath } from '../shared/edit-log';
import { EditLogEntriesComponent } from './edit-log-entries.component';

/** The edit log for one speaker or session, shown in its editor. */
@Component({
  selector: 'app-edit-history',
  template: `
    @if (entries.failed()) {
      <p class="error" role="alert">Couldn't load the history.</p>
    } @else if (!entries.loaded()) {
      <p class="muted" role="status">Loading history…</p>
    } @else if (mine().length) {
      <app-edit-log-entries [entries]="mine()" [showItem]="false" />
    } @else {
      <p class="muted">No changes logged yet. Changes made from now on appear here.</p>
    }
  `,
  imports: [EditLogEntriesComponent],
})
export class EditHistoryComponent {
  private ds = inject(DataService);

  readonly path = input.required<EditLogPath>();
  readonly key = input.required<string>();

  entries = listResource<EditLogEntry>(
    () => query(this.ds.ref('editLog'), orderByChild('key'), equalTo(this.key())),
    '$key',
  );

  mine = computed(() => this.entries().filter((entry) => entry.path === this.path()));
}
