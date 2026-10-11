#!/usr/bin/env python3
"""Make web-ready versions of every photo listed in content/photos.json.

For each entry it writes WebP and JPEG copies at a few widths into
assets/img/, plus assets/img/manifest.json, which build.mjs reads for
srcset and width/height attributes. All metadata (EXIF, GPS, camera info)
is dropped from the outputs. Needs Pillow: python3 -m pip install pillow
"""
import json
import pathlib
import sys

from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "photos"
OUT = ROOT / "assets" / "img"
WIDTHS = [480, 800, 1200, 1600, 2000]
OG_SIZE = (1200, 630)


def load(path):
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)  # bake in rotation before EXIF is dropped
    return im.convert("RGB")


def main():
    config = json.loads((ROOT / "content" / "photos.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, entry in config.items():
        if key.startswith("_") or not isinstance(entry, dict) or not entry.get("file"):
            continue
        src = PHOTOS / entry["file"]
        if not src.exists():
            sys.exit(f"photos.json '{key}': {src} not found")
        im = load(src)
        if entry.get("crop"):
            l, t, r, b = entry["crop"]
            w, h = im.size
            im = im.crop((round(l * w), round(t * h), round(r * w), round(b * h)))
        w, h = im.size
        widths = [x for x in WIDTHS if x < w] + [w]
        for x in widths:
            y = round(h * x / w)
            resized = im if x == w else im.resize((x, y), Image.LANCZOS)
            # Saving without exif= / icc tags strips all metadata.
            resized.save(OUT / f"{key}-{x}.webp", "WEBP", quality=84, method=6)
            resized.save(OUT / f"{key}-{x}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
        manifest[key] = {"width": w, "height": h, "widths": widths}
        print(f"{key}: {w}x{h} -> {widths}")

    # Social preview image (Open Graph / Twitter): hero photo cropped to 1200x630.
    hero = config.get("hero")
    if hero and hero.get("file"):
        im = load(PHOTOS / hero["file"])
        og = ImageOps.fit(im, OG_SIZE, Image.LANCZOS, centering=(0.5, 0.42))
        og.save(OUT / "og.jpg", "JPEG", quality=86, optimize=True, progressive=True)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
