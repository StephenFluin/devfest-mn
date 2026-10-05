#!/usr/bin/env bash
# Regenerate the 1200x630 social share image (src/a/images/og-image.jpg).
# Needs ImageMagick 7 and Inkscape. Update the date line each year.
set -euo pipefail

cd "$(dirname "$0")/../src/a"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

inkscape images/devfestmn.svg --export-type=png --export-filename="$tmp/logo.png" --export-width=560
magick images/hero-cover.webp -resize 1200x630^ -gravity center -extent 1200x630 \
    \( -size 1200x630 xc:'rgba(255,255,255,0.35)' \) -composite \
    -fill 'rgba(255,255,255,0.85)' -draw 'rectangle 0,450 1200,630' \
    \( "$tmp/logo.png" -resize x380 \) -gravity north -geometry +0+40 -composite \
    -font montserrat-latin-400-700.woff2 -fill '#222' -stroke '#222' \
    -strokewidth 2.2 -pointsize 46 -gravity south -annotate +0+95 'Saturday, December 5th, 2026' \
    -strokewidth 1.4 -pointsize 34 -annotate +0+40 'Twin Cities Developer Conference' \
    -strip -quality 85 images/og-image.jpg
