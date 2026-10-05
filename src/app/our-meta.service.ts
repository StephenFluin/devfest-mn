import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { Injectable, inject, DOCUMENT } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OurMeta {
    title = inject(Title);
    meta = inject(Meta);
    private doc = inject(DOCUMENT);

    setTitle(title: string) {
        this.applyTitle(`${title} | ${environment.siteName}`);
    }
    clearTitle() {
        this.applyTitle(`${environment.siteName} ${environment.year}`);
    }

    setDescription(description: string = environment.siteDescription) {
        this.meta.updateTag({ name: 'description', content: description });
        this.meta.updateTag({ property: 'og:description', content: description });
        this.meta.updateTag({ name: 'twitter:description', content: description });
    }

    /** Point search engines and social cards at the absolute URL for `path` (no leading slash). */
    setCanonical(path: string) {
        const url = path ? `${environment.siteUrl}/${path}` : environment.siteUrl;
        let canonical = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical) {
            canonical = this.doc.createElement('link');
            canonical.rel = 'canonical';
            this.doc.head.appendChild(canonical);
        }
        canonical.href = url;
        this.meta.updateTag({ property: 'og:url', content: url });
    }

    private applyTitle(title: string) {
        this.title.setTitle(title);
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ name: 'twitter:title', content: title });
    }
}
