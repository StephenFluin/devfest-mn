import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ADirective } from '../a.directive';
import { environment } from '../../environments/environment';

@Component({
    selector: 'app-speaker-cfp',
    templateUrl: './speaker-cfp.component.html',
    imports: [ADirective, DatePipe],
})
export class SpeakerCfpComponent {
    environment = environment;
}
