import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { MatButtonModule } from '@angular/material/button';
import { OurMeta } from '../our-meta.service';
import { environment } from '../../environments/environment';

@Component({
  templateUrl: './speakers.component.html',

  imports: [MatButtonModule, SpeakerContainerComponent],
})
export class SpeakersComponent {
  ds = inject(DataService);
  router = inject(Router);
  auth = inject(AuthService);

  speakers = this.ds.speakers;

  thisSpeaker = {};
  showDialog = false;

  year: string;

  constructor() {
    const meta = inject(OurMeta);
    // Name a few speakers so the page shows up for searches on them.
    effect(() => {
      const names = this.speakers()
        .filter((speaker) => speaker.confirmed && speaker.name)
        .map((speaker) => speaker.name);
      if (!names.length) return;
      const listed =
        names.length > 3
          ? `${names.slice(0, 3).join(', ')} and more`
          : names.join(', ').replace(/, ([^,]*)$/, ' and $1');
      meta.setDescription(
        `Meet the speakers at DevFestMN ${environment.year}, ${environment.eventDateDisplay} in Minneapolis, including ${listed}.`,
      );
    });
  }

  addSpeaker() {
    this.router.navigate(['/', 'admin', 'speakers', 'new', 'edit']);
  }
}
