import { Directive, ElementRef } from '@angular/core';

@Directive({
    selector: 'a',
    standalone: true,
})
export class ADirective {
    constructor(public ref: ElementRef) {}

    ngAfterViewInit() {
        if (typeof window === 'undefined') return;

        const link = this.ref.nativeElement;
        if (link.hostname === window.location.hostname) {
            return;
        }

        link.relList.add('noopener');
        // link.relList.add('noreferrer');
        link.target = '_blank';
    }
}
