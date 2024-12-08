import { Component, OnInit } from '@angular/core';
import { ADirective } from '../a.directive';

@Component({
    selector: 'app-speaker-cfp',
    templateUrl: './speaker-cfp.component.html',
    imports: [ADirective]
})
export class SpeakerCfpComponent {}
