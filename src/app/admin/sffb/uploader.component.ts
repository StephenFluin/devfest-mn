import { Component, computed, inject, input, resource } from '@angular/core';
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
    templateUrl: './uploader.component.html',
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
        '$key'
    );

    private downloadUrlsResource = resource({
        params: () => this.images(),
        loader: ({ params }) =>
            Promise.all(params.map((image) => getDownloadURL(ref(this.storage, image.path)))),
    });
    downloadUrls = computed(() =>
        this.downloadUrlsResource.hasValue() ? this.downloadUrlsResource.value() : []
    );

    upload() {
        // Create a root reference
        const inputBox = <HTMLInputElement>document.getElementById('file');
        if (inputBox.files.length <= 0) {
            console.log('No files found to upload.');
            return;
        }

        // This currently only grabs item 0, TODO refactor it to grab them all
        for (const selectedFile of [(<HTMLInputElement>document.getElementById('file')).files[0]]) {
            console.log('Attempting to upload', selectedFile);
            // Make local copies of services because "this" will be clobbered
            const folder = this.folder();
            const path = `/${this.folder()}/${selectedFile.name}`;
            const iRef = ref(this.storage, path);
            // Get the database reference in the injection context before entering the promise
            const imagesRef = dbRef(this.db, `/${folder}/images`);
            // cache files for up to a week
            uploadBytes(iRef, selectedFile, { cacheControl: 'max-age=' + this.maxAge() })
                .then((snapshot) => {
                    console.log(
                        'Uploaded a blob or file! Now storing the reference at',
                        `/${folder}/images/`
                    );
                    // Use the database reference we captured earlier
                    push(imagesRef, { path: path, filename: selectedFile.name });
                    inputBox.value = null;
                })
                .catch((err) => {
                    console.error('Unable to upload file', err);
                });
        }
    }

    delete(image: Image) {
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

    select(image: Image, downloadURL?: string) {
        console.log('update speaker image, set Speaker ImageUrl or something....');
        const folder = this.folder();
        console.log(`${folder}`);

        const path = `/${folder}/imageUrl`;
        const iRef = ref(this.storage, path);

        console.log('Attempting to set image', path, downloadURL);
        // cache files for up to a week
        // iRef.putString(downloadURL)
        // iRef.put(downloadURL)
    }
}
