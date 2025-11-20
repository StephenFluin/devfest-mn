import { Component, computed, HostListener, OnInit, Signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { httpResource } from '@angular/common/http';

interface Photo {
    url: string;
    year: string;
}

interface PhotosByYear {
    year: number;
    photos: string[];
}

@Component({
    selector: 'app-gallery',
    imports: [],
    template: `
        <div class="gallery-container">
            <h1>Photo Gallery</h1>

            <div class="year-sections">
                @for (yearGroup of photosByYear(); track yearGroup.year) {
                <div class="year-section">
                    <h2 class="year-header">{{ yearGroup.year }}</h2>
                    <div class="photo-grid">
                        @for (photoUrl of yearGroup.photos; track photoUrl) {
                        <div class="photo-item" (click)="openFullscreen(photoUrl, yearGroup.year)">
                            <img
                                [src]="photoUrl"
                                loading="lazy"
                                alt="Gallery photo from {{ yearGroup.year }}"
                                class="thumbnail"
                            />
                        </div>
                        }
                    </div>
                </div>
                }
            </div>

            <!-- Fullscreen Modal -->
            @if (selectedPhoto) {
            <div class="fullscreen-overlay" (click)="closeFullscreen()">
                <div class="fullscreen-content" (click)="$event.stopPropagation()">
                    <button class="close-button" (click)="closeFullscreen()">×</button>
                    <img
                        loading="lazy"
                        [src]="selectedPhoto.url"
                        alt="Gallery photo from {{ selectedPhoto.year }}"
                        class="fullscreen-image"
                    />
                    <div class="photo-info">
                        <h3>{{ selectedPhoto.year }}</h3>
                    </div>
                </div>
            </div>
            }
        </div>
    `,
    styles: `
    .gallery-container {
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      margin-bottom: 2rem;
      color: #333;
    }

    .year-sections {
      display: flex;
      flex-direction: column;
      gap: 3rem;
    }

    .year-section {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .year-header {
      font-size: 2rem;
      font-weight: 600;
      color: #333;
      margin: 0;
      padding-bottom: 0.5rem;
      border-bottom: 3px solid #4285f4;
      display: inline-block;
      align-self: flex-start;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .photo-item {
      position: relative;
      cursor: pointer;
      border-radius: 8px;
      overflow: hidden;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .photo-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .thumbnail {
      width: 100%;
      height: 280px;
      object-fit: cover;
      display: block;
    }

    .photo-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
      color: white;
      padding: 1rem;
      transform: translateY(100%);
      transition: transform 0.3s ease;
    }

    .photo-item:hover .photo-overlay {
      transform: translateY(0);
    }

    .photo-title {
      font-weight: 500;
      font-size: 0.9rem;
    }

    .fullscreen-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 2rem;
    }

    .fullscreen-content {
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      text-align: center;
    }

    .close-button {
      position: absolute;
      top: -3rem;
      right: 0;
      background: none;
      border: none;
      color: white;
      font-size: 3rem;
      cursor: pointer;
      z-index: 1001;
      padding: 0;
      width: 3rem;
      height: 3rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.3s ease;
    }

    .close-button:hover {
      opacity: 0.7;
    }

    .fullscreen-image {
      max-width: 100%;
      max-height: 80vh;
      object-fit: contain;
      border-radius: 8px;
    }

    .photo-info {
      margin-top: 1rem;
      color: white;
    }

    .photo-info h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .gallery-container {
        padding: 1rem;
      }
      
      .photo-grid {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }
      
      .fullscreen-content {
        padding: 1rem;
      }
      
      .close-button {
        top: -2rem;
        font-size: 2rem;
        width: 2rem;
        height: 2rem;
      }
    }
  `,
})
export class GalleryComponent {
    photoData = httpResource<Photo[]>(() => '/api/gallery');
    photosByYear = computed(() => {
        let photos = this.photoData.value();
        if (!photos || photos.length === 0) {
            return [];
        }
        const photoGroups = photos.reduce((acc, photo) => {
            const year = parseInt(photo.year);
            if (!acc[year]) {
                acc[year] = [];
            }
            acc[year].push(photo.url);
            return acc;
        }, {} as { [key: number]: string[] });

        // Convert to array format and sort by highest year first
        let photosByYear = Object.entries(photoGroups)
            .map(([year, photos]) => ({
                year: parseInt(year),
                photos: photos,
            }))
            .sort((a, b) => b.year - a.year);
        return photosByYear;
    });

    selectedPhoto: Photo | null = null;

    openFullscreen(photoUrl: string, year: number): void {
        this.selectedPhoto = { url: photoUrl, year: year.toString() };
    }

    closeFullscreen(): void {
        this.selectedPhoto = null;
    }

    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.selectedPhoto) {
            this.closeFullscreen();
        }
    }
}
