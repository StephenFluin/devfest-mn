import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';


@Component({
    selector: 'speaker-container',
    template: `
        @if (speaker) {
          <div>
            @if (speaker.confirmed || showEdit) {
              <div class="speaker-card">
                @if (speaker.imageUrl) {
                  <div>
                    <div
                      class="thumb"
                      [style.background-image]="'url(' + speaker.imageUrl + ')'"
                    ></div>
                  </div>
                }
                <div class="speaker-content">
                  @if (!speaker.confirmed && showEdit) {
                    <div style="background-color: yellow">
                      <strong>NOT CONFIRMED</strong>
                    </div>
                  }
                  <div style="font-size:20px;">
                    <a [routerLink]="['/', 'speakers', speaker.$key, speaker.name]">{{
                      speaker.name
                    }}</a>
                    @if (showEdit) {
                      <a
                        [routerLink]="['/', 'admin', 'speakers', speaker.$key, 'edit']"
                        ><img src="/a/edit.svg"
                      /></a>
                    }
                  </div>
                  <div>{{ speaker.company }}</div>
                  @if (speaker.twitter) {
                    <div>
                      <a href="https://twitter.com/{{ speaker.twitter }}" target="_blank"
                        >&#64;{{ speaker.twitter }}</a
                        >
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        `,
    imports: [RouterLink]
})
export class SpeakerContainerComponent {
    @Input() speaker;
    @Input() showEdit = false;
}
