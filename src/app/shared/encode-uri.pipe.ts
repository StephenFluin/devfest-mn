import { NgModule, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';

@Pipe({
    name: 'encodeURI',
    standalone: true,
})
export class EncodeURI implements PipeTransform {
    transform(value) {
        if (value) {
            return value.replace(/[()]/g, '').replace(/ /g, '-');
        }
    }
}
