import { Component } from '@angular/core';
import { ADirective } from '../a.directive';

@Component({
    templateUrl: './sponsor.component.html',
    imports: [ADirective]
})
export class SponsorsComponent  {
    constructor() { }

}