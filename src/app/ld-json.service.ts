import { DOCUMENT, inject, Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class LdJsonService {
    private rendererFactory = inject(RendererFactory2);
    private renderer: Renderer2;
    doc = inject(DOCUMENT);

    constructor() {
        this.renderer = this.rendererFactory.createRenderer(null, null);
    }

    setLdJson(data: object): void {
        // Remove any existing application/ld+json script tags
        const existingScripts = this.doc.querySelectorAll('script[type="application/ld+json"]');
        existingScripts.forEach((script) => {
            this.renderer.removeChild(this.doc.head, script);
        });

        const script = this.renderer.createElement('script');

        // 2. Set the type attribute
        this.renderer.setAttribute(script, 'type', 'application/ld+json');

        // 3. Add the JSON data as text content
        this.renderer.appendChild(script, this.renderer.createText(JSON.stringify(data)));
        this.renderer.appendChild(this.doc.head, script);
    }
}
