import { Title, Meta } from '@angular/platform-browser';
import { environment } from '../environments/environment';
import { Injectable, inject, DOCUMENT } from '@angular/core';

const DEFAULT_IMAGE_ALT = `${environment.siteName} ${environment.year}, ${environment.eventDateDisplay}, Twin Cities developer conference`;

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

    /** A full page title, used as-is without the site name appended. */
    setPageTitle(title: string) {
        this.applyTitle(title);
    }

    /**
     * The image shown when the page is shared. Width and height are only given for images whose
     * size is known (like generated 1200x630 cards); otherwise the tags are removed.
     */
    setImage(
        url = `${environment.siteUrl}${environment.socialImage}`,
        alt = DEFAULT_IMAGE_ALT,
        size: { width: number; height: number } | undefined = url.endsWith(environment.socialImage)
            ? { width: 1200, height: 630 }
            : undefined
    ) {
        this.meta.updateTag({ property: 'og:image', content: url });
        this.meta.updateTag({ name: 'twitter:image', content: url });
        this.meta.updateTag({ property: 'og:image:alt', content: alt });
        this.meta.updateTag({ name: 'twitter:image:alt', content: alt });
        if (size) {
            this.meta.updateTag({ property: 'og:image:width', content: String(size.width) });
            this.meta.updateTag({ property: 'og:image:height', content: String(size.height) });
        } else {
            this.meta.removeTag('property="og:image:width"');
            this.meta.removeTag('property="og:image:height"');
        }
    }

    /** og:type: 'website' for most pages, 'profile' for a person. */
    setType(type: 'website' | 'profile' = 'website') {
        this.meta.updateTag({ property: 'og:type', content: type });
    }

    private applyTitle(title: string) {
        this.title.setTitle(title);
        this.meta.updateTag({ property: 'og:title', content: title });
        this.meta.updateTag({ name: 'twitter:title', content: title });
    }
}
