import { Component, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { DataService } from '../shared/data.service';

const mapsSearch = (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * Getting to the venue: a map of the campus, where to park, and how to find the rooms once inside.
 */
@Component({
    selector: 'venue-info',
    template: `
        <a
            id="map"
            [href]="environment.venueMapUrl"
            target="_blank"
            aria-label="Open Schulze Hall in Google Maps"
        >
            <img
                src="/a/images/map-ust.webp"
                width="1090"
                height="484"
                loading="lazy"
                alt="Map of the University of St. Thomas Minneapolis campus"
            />
        </a>
        <div class="callout">Venue</div>
        <p>
            <a [href]="environment.venueMapUrl" target="_blank">{{
                environment.venueName
            }}</a
            >, {{ environment.venueAddress }}, at the corner of 11th Street South and Harmon
            Place in downtown Minneapolis.
        </p>
        <div class="callout">Parking</div>
        <p>
            Park in the St. Thomas
            <strong
                ><a [href]="parkingDirections" target="_blank">{{
                    environment.parkingName
                }}</a></strong
            >
            at {{ environment.parkingAddress }}, across 11th Street from Schulze Hall. Take a
            ticket when you enter and pay by card at a pay station or the exit; the ramp
            doesn't take cash. There's a flat weekend rate, and some paid street parking
            nearby. See the
            <a
                href="https://stthomas.edu/_media-library/_documents/parking-transportation/minneapolis-parking-guide.pdf"
                target="_blank"
                >St. Thomas Minneapolis parking guide (PDF)</a
            >
            for a map of the ramp and campus.
        </p>
        <div class="callout">Finding Your Way Inside</div>
        <ol class="wayfinding">
            <li>
                <strong>Registration</strong>
                <span>Ground floor of Schulze Hall. Check in here first.</span>
            </li>
            @for (room of ds.rooms(); track room.name) {
            <li>
                <strong>{{ room.name }}</strong>
                <span>{{ room.directions }}</span>
            </li>
            }
        </ol>
        <p><a [href]="venueDirections" target="_blank">Directions to Schulze Hall</a></p>
    `,
    styles: `
        #map img {
            width: 100%;
            height: auto;
            border-radius: 8px;
        }
        .wayfinding {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 0;
            margin: 16px 0;
            list-style: none;
            counter-reset: step;
        }
        .wayfinding li {
            flex: 1 1 200px;
            padding: 12px 16px;
            border-left: 4px solid #19a9e5;
            counter-increment: step;
        }
        .wayfinding strong::before {
            content: counter(step) '. ';
        }
        .wayfinding strong,
        .wayfinding span {
            display: block;
        }
    `,
})
export class VenueComponent {
    environment = environment;
    ds = inject(DataService);
    parkingDirections = mapsSearch(`${environment.parkingName}, ${environment.parkingAddress}`);
    venueDirections = mapsSearch(`Schulze Hall, ${environment.venueAddress}`);
}

