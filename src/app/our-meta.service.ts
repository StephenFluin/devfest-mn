import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class OurMeta {
    constructor(public title: Title, public meta: Meta, @Inject(DOCUMENT) private doc) {}

    setTitle(title: string) {
        this.title.setTitle(`${title} | ${environment.siteName}`);
    }
    clearTitle() {
        this.title.setTitle(environment.siteName);
    }

    clearCanonical() {
        const existing = this.doc.querySelector('link[rel="canonical"]');
        const head = this.doc.querySelector('head');

        if (existing) {
            head.removeChild(existing);
        }
    }
    setCanonical(path: string) {
        this.clearCanonical();

        const head = this.doc.querySelector('head');

        let canonical = this.doc.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = `/${path}`;

        head.appendChild(canonical);
    }
}
