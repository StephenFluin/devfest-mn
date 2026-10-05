#!/usr/bin/env bash
# Generate WebP previews for the photo gallery grid.
# src/a/images/gallery/<year>/<name>.jpg -> src/a/images/gallery-thumbs/<year>/<name>.webp
# Existing thumbnails are skipped, so this is safe to re-run after adding photos.
set -euo pipefail

cd "$(dirname "$0")/../src/a/images"

find gallery -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) |
    while read -r photo; do
        thumb="gallery-thumbs/${photo#gallery/}"
        thumb="${thumb%.*}.webp"
        if [ -f "$thumb" ]; then
            continue
        fi
        mkdir -p "$(dirname "$thumb")"
        # 700px covers the 350px-wide grid cell on 2x screens.
        magick "$photo" -auto-orient -strip -resize '700x560^' -quality 70 "$thumb"
        echo "Created $thumb"
    done
