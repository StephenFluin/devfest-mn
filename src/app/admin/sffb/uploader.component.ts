import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ref as dbRef, push, remove } from 'firebase/database';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { DATABASE, FIREBASE_APP, listResource } from '../../realtime-data/firebase';

export interface Image {
  path: string;
  filename: string;
  $key?: string;
}

@Component({
  selector: 'sffb-uploader',
  template: `
    <div class="actions">
      <label class="upload" [class.busy]="uploading()">
        <input
          type="file"
          accept="image/*"
          (change)="upload($any($event.target))"
          [disabled]="uploading()"
        />
        {{ uploading() ? 'Uploading…' : 'Upload a photo' }}
      </label>
      @if (error()) {
        <span class="status error" role="alert">{{ error() }}</span>
      }
    </div>
    @if (images().length) {
      <ul class="gallery" aria-label="Uploaded photos">
        @for (img of images(); track img.$key; let i = $index) {
          <li [class.current]="downloadUrls()[i] && downloadUrls()[i] === current()">
            @if (downloadUrls()[i]; as url) {
              <img [src]="url" [alt]="img.filename" />
            } @else {
              <span class="placeholder muted">Loading…</span>
            }
            <div class="tile-actions">
              <button
                mat-flat-button
                type="button"
                [disabled]="!downloadUrls()[i] || downloadUrls()[i] === current()"
                (click)="selected.emit(downloadUrls()[i])"
              >
                {{ downloadUrls()[i] === current() ? 'Current photo' : 'Use this photo' }}
              </button>
              <button
                mat-button
                class="danger"
                type="button"
                (click)="delete(img)"
                [attr.aria-label]="'Delete ' + img.filename"
              >
                Delete
              </button>
            </div>
          </li>
        }
      </ul>
    } @else {
      <p class="muted">No photos uploaded yet.</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .upload {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 40px;
      padding: 0 24px;
      border-radius: 999px;
      border: 1px solid var(--mat-sys-outline);
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .upload:hover {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .upload.busy {
      opacity: 0.6;
      cursor: progress;
    }
    .upload input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .upload:has(input:focus-visible) {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .gallery {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 16px;
      list-style: none;
      padding: 0;
      margin: 16px 0 0;
    }
    .gallery li {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
    }
    .gallery li.current {
      border: 2px solid var(--mat-sys-primary);
    }
    .gallery img,
    .placeholder {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      border-radius: 8px;
      display: grid;
      place-items: center;
      background: var(--mat-sys-surface-container);
    }
    .tile-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
  imports: [MatButtonModule],
})
export class UploaderComponent {
  db = inject(DATABASE);

  /**
   * The name of the folder for images
   * eg. posts/angular-is-awesome
   */
  readonly folder = input<string>(undefined);
  readonly maxAge = input(604800);

  private storage = getStorage(inject(FIREBASE_APP));

  images = listResource<Image>(
    () => (this.folder() ? dbRef(this.db, `/${this.folder()}/images`) : undefined),
    '$key',
  );

  private downloadUrlsResource = resource({
    params: () => this.images(),
    loader: ({ params }) =>
      Promise.all(params.map((image) => getDownloadURL(ref(this.storage, image.path)))),
  });
  downloadUrls = computed(() =>
    this.downloadUrlsResource.hasValue() ? this.downloadUrlsResource.value() : [],
  );

  /** The photo the speaker uses now, to mark it in the gallery. */
  readonly current = input<string | undefined>(undefined);
  /** A photo's download URL, when "Use this photo" is clicked. */
  readonly selected = output<string>();

  uploading = signal(false);
  error = signal('');

  async upload(inputBox: HTMLInputElement) {
    const selectedFile = inputBox.files?.[0];
    if (!selectedFile) return;
    const folder = this.folder();
    const path = `/${folder}/${selectedFile.name}`;
    // Get the database reference in the injection context before awaiting.
    const imagesRef = dbRef(this.db, `/${folder}/images`);
    this.uploading.set(true);
    this.error.set('');
    try {
      // Cache files for up to a week.
      await uploadBytes(ref(this.storage, path), selectedFile, {
        cacheControl: 'max-age=' + this.maxAge(),
      });
      await push(imagesRef, { path, filename: selectedFile.name });
    } catch (err) {
      console.error('Unable to upload file', err);
      this.error.set(`Couldn't upload ${selectedFile.name}.`);
    } finally {
      this.uploading.set(false);
      inputBox.value = '';
    }
  }

  delete(image: Image) {
    if (!confirm(`Delete ${image.filename}?`)) return;
    const storagePath = image.path;
    console.log('deleting image with data', image);
    const referencePath = `${this.folder()}/images/` + image.$key;

    // Do these as two separate steps so you can still try delete ref if file no longer exists

    // Delete from Storage
    const storageRef = ref(this.storage, storagePath);
    deleteObject(storageRef)
      .then(() => {
        console.log('File deleted from storage successfully');
      })
      .catch((error) => {
        console.error('Error deleting stored file', storagePath);
      });

    // Delete references
    console.log('Deleting reference from', referencePath);
    const imageRef = dbRef(this.db, referencePath);
    remove(imageRef)
      .then(() => console.log('File reference deleted successfully from the database'))
      .catch((err) => {
        console.error('File reference was not deleted successfully from the database', err);
      });
  }
}
