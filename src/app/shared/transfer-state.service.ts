import { Injectable, TransferState, makeStateKey, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, EMPTY } from 'rxjs';
import { tap, catchError, take } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class TransferStateService {
    private transferState = inject(TransferState);
    private platformId = inject(PLATFORM_ID);

    /**
     * Cache observable data with transferState
     */
    cacheObservable<T>(key: string, observable: Observable<T>): Observable<T> {
        const stateKey = makeStateKey<T>(key);

        // If we're on the browser and have cached data, return it
        if (isPlatformBrowser(this.platformId)) {
            const cachedData = this.transferState.get(stateKey, null);
            if (cachedData !== null) {
                // Remove the cached data to prevent memory leaks
                this.transferState.remove(stateKey);
                // Return cached data first, then let the observable continue for real-time updates
                return of(cachedData);
            }
        }

        // Otherwise, subscribe to the observable and cache the data
        return observable.pipe(
            tap((data) => {
                // Only cache on server or first browser load
                if (!isPlatformBrowser(this.platformId)) {
                    this.transferState.set(stateKey, data);
                }
            }),
            catchError((error) => {
                console.error(`Error loading data for key ${key}:`, error);
                // Return empty array/object based on the expected type to prevent blank states
                if (key.includes('schedule') || key.includes('speakers')) {
                    return of([] as any);
                }
                throw error;
            })
        );
    }
}
