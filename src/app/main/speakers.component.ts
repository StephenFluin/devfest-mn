import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { get } from 'firebase/database';
import { DataService, Session, SpeakerInvite } from '../shared/data.service';
import { AuthService } from '../realtime-data/auth.service';
import { OurMeta } from '../our-meta.service';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { inviteLink, sendInviteEmail } from '../speaker-invite/invite-email';
import { slugify } from '../shared/slug';
import { SpeakerManagementComponent } from './speaker-management.component';
import { SpeakerEditLinkComponent } from './speaker-edit-link.component';

type SpeakerSort = 'name' | 'sessions' | 'published' | 'updatedAt';

@Component({
  templateUrl: './speakers.component.html',

  imports: [
    FormsModule,
    SpeakerManagementComponent,
    SpeakerEditLinkComponent,
    RouterLink,
    DatePipe,
  ],
})
export class SpeakersComponent {
  ds = inject(DataService);
  router = inject(Router);
  auth = inject(AuthService);

  speakers = this.ds.speakers;
  publishedCount = computed(() => this.speakers().filter((speaker) => speaker.published).length);
  slugify = slugify;
  environment = environment;
  inviteLink = inviteLink;
  view = signal<'tiles' | 'table'>('tiles');
  publication = signal<'all' | 'published' | 'unpublished'>('all');
  sortColumn = signal<SpeakerSort>('name');
  sortDirection = signal<'ascending' | 'descending'>('ascending');
  linkStatus = signal('');
  copiedInvite = signal<string | null>(null);

  /** Private tokens stay in memory and are only fetched for an admin's table view. */
  invites = resource({
    params: () => (this.auth.isAdmin() && this.view() === 'table' ? this.auth.uid() : undefined),
    loader: async () => {
      const snapshot = await get(this.ds.ref('speakerInvites'));
      const invites: SpeakerInvite[] = [];
      snapshot.forEach((child) => {
        invites.push({ ...child.val(), $key: child.key });
      });
      return invites;
    },
  });

  private inviteBySpeaker = computed(() => {
    const latest = new Map<string, SpeakerInvite>();
    if (this.auth.isAdmin() && this.invites.hasValue()) {
      for (const invite of this.invites.value()) {
        const previous = latest.get(invite.speaker);
        if (!previous || (invite.createdAt ?? 0) > (previous.createdAt ?? 0)) {
          latest.set(invite.speaker, invite);
        }
      }
    }
    return latest;
  });

  visibleSpeakers = computed(() => {
    const admin = this.auth.isAdmin();
    return this.speakers().filter((speaker) => {
      if (!admin) return speaker.published;
      return (
        this.publication() === 'all' || !!speaker.published === (this.publication() === 'published')
      );
    });
  });

  rows = computed(() => {
    const rows = this.visibleSpeakers().map((speaker) => ({
      speaker,
      sessions: this.ds.sessionsFor(speaker.$key, { unpublished: true }),
      invite: this.inviteBySpeaker().get(speaker.$key),
    }));
    const direction = this.sortDirection() === 'ascending' ? 1 : -1;
    const column = this.sortColumn();
    return rows.sort((a, b) => {
      let comparison: number;
      switch (column) {
        case 'published':
          comparison = Number(!!a.speaker.published) - Number(!!b.speaker.published);
          break;
        case 'updatedAt':
          comparison = (a.speaker.updatedAt ?? 0) - (b.speaker.updatedAt ?? 0);
          break;
        case 'sessions':
          comparison = a.sessions
            .map((session) => session.title ?? '')
            .join(', ')
            .localeCompare(b.sessions.map((session) => session.title ?? '').join(', '));
          break;
        default:
          comparison = (a.speaker.name ?? '').localeCompare(b.speaker.name ?? '');
      }
      return comparison * direction || (a.speaker.name ?? '').localeCompare(b.speaker.name ?? '');
    });
  });

  /** Each speaker's public sessions, for the talk titles on their tile. */
  talks = computed(() => {
    const talks = new Map<string, Session[]>();
    for (const session of this.ds.publishedSchedule()) {
      if (!session.title) continue;
      for (const key of Object.values(session.speakers ?? {})) {
        talks.set(key, [...(talks.get(key) ?? []), session]);
      }
    }
    return talks;
  });

  initials = (name = '') =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  sortBy(column: SpeakerSort) {
    if (this.sortColumn() === column) {
      this.sortDirection.update((direction) =>
        direction === 'ascending' ? 'descending' : 'ascending',
      );
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set(column === 'updatedAt' ? 'descending' : 'ascending');
    }
  }

  ariaSort(column: SpeakerSort) {
    return this.sortColumn() === column ? this.sortDirection() : 'none';
  }

  sortIndicator(column: SpeakerSort) {
    return this.sortColumn() === column
      ? this.sortDirection() === 'ascending'
        ? ' ↑'
        : ' ↓'
      : ' ↕';
  }

  async copyInvite(token: string, name: string) {
    this.linkStatus.set('');
    this.copiedInvite.set(null);
    try {
      await navigator.clipboard.writeText(inviteLink(token));
      this.copiedInvite.set(token);
      this.linkStatus.set(`Copied the speaker edit link for ${name}. You can now send it to them.`);
    } catch {
      this.linkStatus.set(
        'Could not copy the link. Right-click Open speaker editor and copy its address.',
      );
    }
  }

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
      this.invites.reload();
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
