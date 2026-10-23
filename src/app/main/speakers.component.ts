import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { MatButtonModule } from '@angular/material/button';
import { OurMeta } from '../our-meta.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { inviteLink, sendInviteEmail } from '../speaker-invite/invite-email';

@Component({
  templateUrl: './speakers.component.html',

  imports: [MatButtonModule, FormsModule, SpeakerContainerComponent],
})
export class SpeakersComponent {
  ds = inject(DataService);
  router = inject(Router);
  auth = inject(AuthService);

  speakers = this.ds.speakers;

  showInvite = signal(false);
  inviteName = '';
  inviteEmail = '';
  sending = signal(false);
  /** The invite just created, so the admin can copy the link if the email didn't go out. */
  sent = signal<{ name: string; link: string; error?: string } | null>(null);

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

  async sendInvite() {
    const name = this.inviteName.trim();
    const email = this.inviteEmail.trim();
    if (!name || !email || this.sending()) return;
    this.sending.set(true);
    try {
      const token = await this.ds.inviteSpeaker(name, email);
      this.inviteName = '';
      this.inviteEmail = '';
      this.showInvite.set(false);
      try {
        await sendInviteEmail(await this.auth.auth?.currentUser?.getIdToken(), token);
        this.sent.set({ name, link: inviteLink(token) });
      } catch (err) {
        this.sent.set({ name, link: inviteLink(token), error: err.message });
      }
    } catch (err) {
      console.error('Unable to invite speaker', err);
      alert('Unable to invite speaker: ' + err);
    } finally {
      this.sending.set(false);
    }
  }

  addSpeaker() {
    this.router.navigate(['/', 'admin', 'speakers', 'new', 'edit']);
  }
}
