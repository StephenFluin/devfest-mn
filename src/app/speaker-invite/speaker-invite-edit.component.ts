import { Component, computed, inject, PLATFORM_ID, resource, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { signInAnonymously } from 'firebase/auth';
import { get, set } from 'firebase/database';

import { DataService, Speaker, SpeakerInvite } from '../shared/data.service';
import { AUTH } from '../realtime-data/firebase';
import { AuthService } from '../realtime-data/auth.service';

/** Fields a speaker may edit on their own profile. Confirming stays with the organizers. */
const EDITABLE = ['name', 'bio', 'company', 'twitter', 'imageUrl', 'website', 'linkedin'] as const;

/**
 * The page behind a speaker's invite link. Anyone with the link can edit that one speaker: the
 * visitor signs in anonymously (unless already signed in), then records a grant at
 * speakerGrants/<uid>, which the database rules only accept with a real invite token.
 */
@Component({
  template: `
    <section class="invite-edit">
      @switch (access.status()) {
        @case ('error') {
          <h1>Link not valid</h1>
          <p>
            This speaker link didn't work. Ask the DevFestMN team for a new one at
            <a href="mailto:info@devfest.mn">info&#64;devfest.mn</a>.
          </p>
        }
        @case ('resolved') {
          @if (speaker(); as speaker) {
            <h1>Your DevFestMN speaker profile</h1>
            <p>
              Anyone with this page's link can edit your profile, so please keep it private. Your
              profile appears on the site once we've confirmed your talk.
            </p>
            <form (ngSubmit)="save(speaker)">
              <label>Name <input name="name" [(ngModel)]="speaker.name" required /></label>
              <label
                >Bio (Markdown)
                <textarea name="bio" [(ngModel)]="speaker.bio" rows="8"></textarea>
              </label>
              <label>Company <input name="company" [(ngModel)]="speaker.company" /></label>
              <label
                >Twitter handle
                <input name="twitter" [(ngModel)]="speaker.twitter" placeholder="without the @"
              /></label>
              <label
                >Photo URL <input name="imageUrl" type="url" [(ngModel)]="speaker.imageUrl"
              /></label>
              @if (speaker.imageUrl) {
                <img class="preview" [src]="speaker.imageUrl" alt="Your photo" />
              }
              <label
                >Website <input name="website" type="url" [(ngModel)]="speaker.website"
              /></label>
              <label
                >LinkedIn profile URL
                <input name="linkedin" type="url" [(ngModel)]="speaker.linkedin"
              /></label>
              <button type="submit" [disabled]="saving()">Save profile</button>
              @if (status(); as status) {
                <span>{{ status }}</span>
              }
            </form>
          } @else {
            <p>Loading your profile...</p>
          }
        }
        @default {
          <p>Loading your profile...</p>
        }
      }
    </section>
  `,
  styles: `
    .invite-edit {
      max-width: 640px;
      margin: 0 auto;
      padding: 16px;
      text-align: left;
    }
    label {
      display: block;
      margin: 16px 0;
    }
    input,
    textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      padding: 6px;
    }
    .preview {
      max-width: 160px;
      max-height: 160px;
    }
  `,
  imports: [FormsModule],
})
export class SpeakerInviteEditComponent {
  ds = inject(DataService);
  private authService = inject(AuthService);
  private auth = inject(AUTH);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  saving = signal(false);
  status = signal('');

  /** Resolves to the invited speaker's key once this visitor may edit them. */
  access = resource({
    params: () => (this.isBrowser ? this.params().get('token') : undefined),
    loader: async ({ params: token }) => {
      const invite = (await get(this.ds.ref(`speakerInvites/${token}`))).val() as SpeakerInvite;
      if (!invite?.speaker) {
        throw new Error('No such invite');
      }
      await this.auth.authStateReady();
      if (!this.auth.currentUser) {
        await signInAnonymously(this.auth);
      }
      const uid = this.auth.currentUser.uid;
      if (!(await this.authService.checkAdmin())) {
        await set(this.ds.ref(`speakerGrants/${uid}`), { token, speaker: invite.speaker });
      }
      return invite.speaker;
    },
  });

  /** A copy, so form edits don't leak into the shared live data before saving. */
  speaker = computed<Speaker | undefined>(() => {
    if (!this.access.hasValue()) return undefined;
    const item = this.ds.speaker(this.access.value());
    return item && { ...item };
  });

  async save(speaker: Speaker) {
    this.saving.set(true);
    this.status.set('');
    try {
      const changes: Speaker = { $key: speaker.$key };
      for (const field of EDITABLE) {
        changes[field] = speaker[field]?.trim() || undefined;
      }
      changes.twitter = changes.twitter?.replace(/^@/, '') || undefined;
      await this.ds.save('speakers', changes);
      this.status.set('Saved. Thanks!');
    } catch (err) {
      console.error('Unable to save speaker', err);
      this.status.set('Sorry, saving failed. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
