import { Component } from '@angular/core';
import { ADirective } from '../a.directive';

@Component({
    templateUrl: './sponsor.component.html',
    standalone: true,
    imports: [ADirective],
})
export class SponsorsComponent  {
    constructor() { }

}