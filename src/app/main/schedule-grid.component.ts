import { Component, computed, inject, input } from '@angular/core';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { GetSpeakerPipe } from '../shared/get-speaker.pipe';
import { slugify } from '../shared/slug';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { JsonPipe, KeyValuePipe } from '@angular/common';
import { TRACKS } from '../shared/tracks';

@Component({
  selector: 'app-schedule-grid',
  templateUrl: 'schedule-grid.component.html',
  imports: [RouterLink, MatButtonModule, JsonPipe, KeyValuePipe, GetSpeakerPipe],
})
export class ScheduleGridComponent {
  slugify = slugify;
  ds = inject(DataService);
  auth = inject(AuthService);

  readonly data = input(undefined);
  readonly forceMobile = input<boolean>(undefined);

  /**
   * What the colors mean: the tracks of the sessions shown, in the usual order, plus "Other" for
   * sessions whose track has no color of its own.
   */
  legend = computed(() => {
    const used = new Set<string>();
    for (const slot of Object.values(this.data()?.gridData ?? {})) {
      for (const session of Object.values(slot as object)) {
        if (session?.title) used.add(session.track ?? '');
      }
    }
    const known = TRACKS.filter((track) => used.has(track.name));
    const other = [...used].some((name) => !TRACKS.some((track) => track.name === name));
    return other ? [...known, { name: '', label: 'Other' }] : known;
  });
}
