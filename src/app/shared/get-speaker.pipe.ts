import { Pipe, PipeTransform, inject } from '@angular/core';
import { DataService, Speaker } from './data.service';

/**
 * Take a speaker ID and returns a speaker
 *
 * example template expression:
 * {{ (speakerKey | getSpeaker)?.name }}
 */
@Pipe({
    name: 'getSpeaker',
    // Impure so it picks up changes to the live speakers signal.
    pure: false,
})
export class GetSpeakerPipe implements PipeTransform {
    private ds = inject(DataService);

    transform(value: string): Speaker | undefined {
        return value ? this.ds.speaker(value) : undefined;
    }
}
