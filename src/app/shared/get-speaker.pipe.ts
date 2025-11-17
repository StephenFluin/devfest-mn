import { Pipe, PipeTransform, inject } from '@angular/core';
import { DataService, Speaker } from './data.service';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
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
    private ds = inject(DataService);

    transform(value: string): Observable<Speaker> {
c        if (value) {
            let speakers = this.ds.getSpeakers(environment.year);
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
