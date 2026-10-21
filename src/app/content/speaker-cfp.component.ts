import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ADirective } from '../a.directive';
import { environment } from '../../environments/environment';
import { cfpCountdown, cfpState } from '../shared/cfp-deadline';
import { trackCfpClick } from '../analytics.util';

@Component({
  selector: 'app-speaker-cfp',
  templateUrl: './speaker-cfp.component.html',
  imports: [ADirective, DatePipe],
})
export class SpeakerCfpComponent {
  environment = environment;
  countdown = cfpCountdown();
  cfp = cfpState();
  trackCfpClick = trackCfpClick;
}
