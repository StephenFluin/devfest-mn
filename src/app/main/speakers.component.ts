import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DataService } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { SpeakerContainerComponent } from './speaker-container.component';
import { OurMeta } from '../our-meta.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { inviteLink, sendInviteEmail } from '../speaker-invite/invite-email';

@Component({
  templateUrl: './speakers.component.html',

  imports: [FormsModule, SpeakerContainerComponent],
})
export class SpeakersComponent {
  ds = inject(DataService);
  router = inject(Router);
  auth = inject(AuthService);

  speakers = this.ds.speakers;

  showInvite = signal(false);
  inviteName = signal('');
  inviteEmail = signal('');
  sending = signal(false);
  /** The invite just created, so the admin can copy the link if the email didn't go out. */
  sent = signal<{ name: string; link: string; error?: string } | null>(null);

  constructor() {
    const meta = inject(OurMeta);
    // Name a few speakers so the page shows up for searches on them.
    effect(() => {
      const names = this.speakers()
        .filter((speaker) => speaker.published && speaker.name)
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

  /**
   * Updates an invite field, splitting a pasted address like `Luke Schlangen <luke@example.com>`
   * into the name and email fields whichever field it lands in.
   */
  setInviteField(
    field: 'name' | 'email',
    value: string,
    nameInput: HTMLInputElement,
    emailInput: HTMLInputElement,
  ) {
    const match = value.match(/^\s*"?([^"<]*?)"?\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
    if (match) {
      // Write the inputs directly too: if a model value didn't change, Angular won't redraw it.
      this.inviteName.set(match[1] || this.inviteName());
      this.inviteEmail.set(match[2]);
      nameInput.value = this.inviteName();
      emailInput.value = this.inviteEmail();
    } else if (field === 'name') {
      this.inviteName.set(value);
    } else {
      this.inviteEmail.set(value);
    }
  }

  async sendInvite() {
    const name = this.inviteName().trim();
    const email = this.inviteEmail().trim();
    if (!name || !email || this.sending()) return;
    this.sending.set(true);
    try {
      const token = await this.ds.inviteSpeaker(name, email);
      this.inviteName.set('');
      this.inviteEmail.set('');
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
