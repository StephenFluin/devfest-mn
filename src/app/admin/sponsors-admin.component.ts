import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { child, push, serverTimestamp, set, update } from 'firebase/database';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { environment } from '../../environments/environment';
import { AuthService } from '../realtime-data/auth.service';
import { FIREBASE_APP, listResource } from '../realtime-data/firebase';
import { DataService } from '../shared/data.service';
import { isSponsorLogo, isSponsorWebsite, Sponsor, SponsorDetails } from '../shared/sponsor';
import { formChanged, UnsavedChangesForm, warnOnPageUnload } from '../shared/unsaved-changes';

const emptySponsor: SponsorDetails = { name: '', level: '', logo: '', url: '', visible: false };
const logoTypes = ['image/png', 'image/jpeg', 'image/webp'];

@Component({
  templateUrl: './sponsors-admin.component.html',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
  styles: `
    .sponsors {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
      gap: var(--admin-gap);
      align-items: start;
    }
    @media (max-width: 880px) {
      .sponsors {
        grid-template-columns: 1fr;
      }
      .editor {
        grid-row: 1;
      }
    }
    .sponsor-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .sponsor-list li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .sponsor-list li:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .sponsor-list img {
      width: 56px;
      height: 40px;
    }
    .sponsor-list .details {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .sponsor-list button {
      flex-shrink: 0;
    }
    fieldset {
      border: 0;
      padding: 0;
      margin: 0;
      min-width: 0;
    }
    .logo-preview {
      display: block;
      width: 160px;
      height: 72px;
      max-width: 100%;
    }
    .sponsor-list img,
    .logo-preview {
      padding: 6px;
      box-sizing: border-box;
      border-radius: 4px;
      background: var(--color-brand-surface);
      object-fit: contain;
    }
    .file {
      display: grid;
      gap: 4px;
      margin: 0 0 16px;
    }
    .file input {
      max-width: 100%;
    }
    .visibility {
      margin: 4px 0 16px;
    }
  `,
})
export class SponsorsAdminComponent implements UnsavedChangesForm {
  private auth = inject(AuthService);
  private sponsorsRef = inject(DataService).ref('sponsors');
  private firebase = inject(FIREBASE_APP);
  private injector = inject(Injector);
  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private logoInput = viewChild<ElementRef<HTMLInputElement>>('logoInput');
  protected original: Sponsor | null = null;

  private saved = listResource<Sponsor>(
    () => (this.auth.isAdmin() ? this.sponsorsRef : undefined),
    '$key',
  );
  readonly loaded = this.saved.loaded;
  readonly loadFailed = this.saved.failed;
  readonly sponsors = computed(() => [...this.saved()].sort((a, b) => a.order - b.order));
  readonly levels = computed(() => [...new Set(this.sponsors().map((sponsor) => sponsor.level))]);

  readonly draft = signal<SponsorDetails | null>(null);
  readonly logoFile = signal<{ file: File; preview: string } | null>(null);
  readonly logoPreview = computed(() => {
    const logo = this.draft()?.logo.trim() ?? '';
    return this.logoFile()?.preview ?? (isSponsorLogo(logo) ? logo : '');
  });
  readonly saving = signal(false);
  readonly error = signal('');
  readonly status = signal('');

  constructor() {
    warnOnPageUnload(this);
    inject(DestroyRef).onDestroy(() => this.setLogoFile(null));
  }

  hasUnsavedChanges() {
    const draft = this.draft();
    if (!draft) return false;
    const { name, level, logo, url, visible } = this.original ?? emptySponsor;
    return !!this.logoFile() || formChanged({ name, level, logo, url, visible }, draft);
  }

  open(sponsor: Sponsor | null = null) {
    if (this.hasUnsavedChanges() && !confirm('Discard your unsaved sponsor changes?')) return;
    this.close();
    this.status.set('');
    this.original = sponsor;
    const { name, level, logo, url, visible } = sponsor ?? emptySponsor;
    this.draft.set({ name, level, logo, url, visible });
    afterNextRender(() => this.nameInput()?.nativeElement.focus(), { injector: this.injector });
  }

  close() {
    this.draft.set(null);
    this.original = null;
    this.clearLogoFile();
    this.error.set('');
  }

  edit(changes: Partial<SponsorDetails>) {
    this.draft.update((draft) => ({ ...draft, ...changes }));
    this.error.set('');
  }

  pickLogo(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (!logoTypes.includes(file.type) || file.size === 0 || file.size >= 5 * 1024 * 1024) {
      this.clearLogoFile();
      this.error.set('Choose a PNG, JPEG, or WebP image smaller than 5 MB.');
      return;
    }
    this.setLogoFile(file);
    this.error.set('');
  }

  clearLogoFile() {
    const input = this.logoInput()?.nativeElement;
    if (input) input.value = '';
    this.setLogoFile(null);
  }

  private setLogoFile(file: File | null) {
    const selection = this.logoFile();
    if (selection) URL.revokeObjectURL(selection.preview);
    this.logoFile.set(file ? { file, preview: URL.createObjectURL(file) } : null);
  }

  async save() {
    const draft = this.draft();
    if (this.saving() || !draft) return;
    const original = this.original;
    const file = this.logoFile()?.file;
    const details = {
      name: draft.name.trim(),
      level: draft.level.trim(),
      url: draft.url.trim(),
      logo: draft.logo.trim(),
      visible: draft.visible,
    };
    if (!details.name || !details.level || !isSponsorWebsite(details.url)) {
      this.error.set('Enter a sponsor name, level, and an HTTP or HTTPS destination URL.');
      return;
    }
    if (!file && !isSponsorLogo(details.logo)) {
      this.error.set('Choose a logo file or enter a valid logo URL.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    let uploaded: ReturnType<typeof ref> | undefined;
    try {
      if (file) {
        const storage = getStorage(this.firebase);
        const target = ref(storage, `devfest${environment.year}/sponsors/${crypto.randomUUID()}`);
        await uploadBytes(target, file, { contentType: file.type, cacheControl: 'max-age=604800' });
        uploaded = target;
        details.logo = await getDownloadURL(target);
      }
      if (original) {
        // Update only the fields edited here so concurrent changes to other fields survive.
        const changes = Object.fromEntries(
          Object.entries(details).filter(([field, value]) => original[field] !== value),
        );
        await update(child(this.sponsorsRef, original.$key), changes);
      } else {
        await set(push(this.sponsorsRef), { ...details, order: serverTimestamp() });
      }
      this.close();
      this.status.set(`Saved ${details.name}.`);
    } catch (error) {
      if (uploaded) {
        await deleteObject(uploaded).catch((failure) =>
          console.error('Error removing logo', failure),
        );
      }
      console.error('Error saving sponsor', error);
      this.error.set(
        file && error.code === 'storage/unauthorized'
          ? 'Logo uploads require the Firebase Storage admin role. You can also paste a logo URL.'
          : `Couldn’t save ${details.name}. Try again.`,
      );
    } finally {
      this.saving.set(false);
    }
  }
}
