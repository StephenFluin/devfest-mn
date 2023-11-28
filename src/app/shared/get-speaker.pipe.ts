import { Pipe, PipeTransform } from '@angular/core';
import { DataService, Speaker } from './data.service';
import { map } from 'rxjs/operators';
import { YearService } from '../year.service';
import { NEVER, Observable } from 'rxjs';

/**
 * Take a speaker ID and returns a speaker
 *
 * example template expression:
 * {{ (community | getSpeaker | async)?.['name'] }}
 */
@Pipe({
    name: 'getSpeaker',
    standalone: true,
})
export class GetSpeakerPipe implements PipeTransform {
    constructor(private ds: DataService, private yearService: YearService) {}

    transform(value: string): Observable<Speaker> {
        console.log('evaluating value of pipe');
        if (value) {
            let speakers = this.ds.getSpeakers(this.yearService.year);
            return speakers.pipe(
                map((list) => {
                    if (list) {
                        return list.find((item) => item.$key === value);
                    } else {
                        return null;
                    }
                })
            );
        }
        return NEVER;
    }
}
