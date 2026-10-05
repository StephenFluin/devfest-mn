import { Pipe, PipeTransform } from '@angular/core';
import { slugify } from './slug';

@Pipe({
    name: 'encodeURI',
    standalone: true,
})
export class EncodeURI implements PipeTransform {
    transform(value: string | undefined) {
        return slugify(value);
    }
}
