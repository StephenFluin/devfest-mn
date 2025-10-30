import { Component, inject } from '@angular/core';

@Component({
    selector: 'app-test',
    imports: [],
    template: `
        <p>
            This is a test component. It only shows the data below if enabled is set to true. But it
            doesn't load the code for OtherService until the button is clicked.
            <button (click)="enable()">Enable OtherService</button>"
        </p>
    `,
    styles: ``,
})
export class TestComponent {
    enabled = false;
    otherService = inject(OtherService, { optional: true });
    enable() {
        this.enabled = true;
        // Load and Provide OtherService dynamically
    }
}
