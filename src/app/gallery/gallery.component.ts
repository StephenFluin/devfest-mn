import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Photo {
    url: string;
    year: string;
}

@Component({
    selector: 'app-gallery',
    imports: [CommonModule],
    template: `
        <div class="gallery-container">
            <h1>Photo Gallery</h1>

            <div class="photo-grid">
                <div
                    class="photo-item"
                    *ngFor="let photo of photos"
                    (click)="openFullscreen(photo)"
                >
                    <img [src]="photo.url" alt="Gallery photo" class="thumbnail" />
                </div>
            </div>

            <!-- Fullscreen Modal -->
            <div class="fullscreen-overlay" *ngIf="selectedPhoto" (click)="closeFullscreen()">
                <div class="fullscreen-content" (click)="$event.stopPropagation()">
                    <button class="close-button" (click)="closeFullscreen()">×</button>
                    <img [src]="selectedPhoto.url" alt="Gallery photo" class="fullscreen-image" />
                </div>
            </div>
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

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
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
      height: 200px;
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
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 0.5rem;
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
    selectedPhoto: Photo | null = null;

    // Photos from the DevFest gallery organized by year
    photos: Photo[] = [
        // 2015 Photos
        {
            url: '/a/images/gallery/2015/20150321_083513_210.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/20150321_090702_087.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/20150321_095008_025.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150320_180455.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150320_180738.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150321_065456.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150321_065624.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150321_065639-EFFECTS.jpg',
            year: '2015',
        },
        {
            url: '/a/images/gallery/2015/IMG_20150321_091753.jpg',
            year: '2015',
        },
        // 2017 Photos
        {
            url: '/a/images/gallery/2017/2017-02-04 12.49.31 copy.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/20170204_085058.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/20170204_090148.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/7264541D-1763-4C30-BDE8-DC173271FE73.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/CB6D865F-5900-471B-A9C8-63FEB0DDB2D6.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/DSC00795.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/DSC00819.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/DSC00847.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/EE1FDCCF-45F4-47A1-8461-A5D2FBD47F2A.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_-3gd6s3.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_20170204_085927.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_20170204_090244.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_20170204_214448.jpg',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_2881.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_2902.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_2921.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_2929.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_2932.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/IMG_8087.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/LND_24555B8D-B473-4F23-985F-0A35C5577DB0.JPG',
            year: '2017',
        },
        {
            url: '/a/images/gallery/2017/LND_39A8521B-915E-4057-8DCA-7B15064556CE.JPG',
            year: '2017',
        },
        // 2023 Photos
        {
            url: '/a/images/gallery/2023/20231202091239_R5__6278.JPG',
            year: '2023',
        },
        {
            url: '/a/images/gallery/2023/PXL_20231202_143202089.jpg',
            year: '2023',
        },
        {
            url: '/a/images/gallery/2023/PXL_20231202_150034478.jpg',
            year: '2023',
        },
        {
            url: '/a/images/gallery/2023/PXL_20231202_154842461.jpg',
            year: '2023',
        },
        {
            url: '/a/images/gallery/2023/R5__6328.JPG',
            year: '2023',
        },
    ];

    openFullscreen(photo: Photo): void {
        this.selectedPhoto = photo;
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
