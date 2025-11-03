import { Component } from '@angular/core';

@Component({
    selector: 'app-refunds',
    template: `
        <section>
            <h2>Refunds</h2>
            <p>
                Refunds are available up to 14 days before the event and are handled 100% through
                Eventbrite. Eventbrite takes a fee of all ticket sales, so we're only able to return
                the ticket price minus any fees they charge (about $5).
            </p>
        </section>
    `,
    styles: ``,
})
export class RefundsComponent {}
