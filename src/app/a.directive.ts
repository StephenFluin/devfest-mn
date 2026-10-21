import { Directive, ElementRef, inject, AfterViewInit } from '@angular/core';

@Directive({
  // Applies to every link on purpose.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'a',
  standalone: true,
})
export class ADirective implements AfterViewInit {
  ref = inject(ElementRef);

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
