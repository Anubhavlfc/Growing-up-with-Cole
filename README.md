# Growing Up With J. Cole

A personal essay by Anubhav Adhikari, published as an editorial, scroll-driven web page.

**Live site:** https://anubhavlfc.github.io/Growing-up-with-Cole/

The site is plain HTML, CSS and JavaScript with no frameworks. A small build script turns the essay file into the final page, and GitHub Actions publishes it to GitHub Pages on every push to `main`.

## Where things live

```
content/
  essay.md        the essay itself (edit this to change the words)
  photos.json     every photo on the page: file, alt text, optional caption and credit
  site.json       public URL, description for link previews, footer links
photos/           original photos (location and camera metadata already removed)
assets/
  css/tokens.css  colours, fonts, sizes, timing (the design system)
  css/site.css    layout, components and animation
  js/site.js      scroll reveals, progress bar, contents menu, the flight map, lightbox
  fonts/          self-hosted fonts (Fraunces, Newsreader, Hanken Grotesk)
src/template.html the page shell (head, hero, navigation, footer)
src/nepal-2019.svg   the illustration of a sixteen-year-old listening in his room in Nepal
src/journey-map.svg  the Kathmandu to New York map (generated, see below)
scripts/optimize_images.py  makes resized WebP/JPEG versions of each photo
scripts/make_map.mjs        regenerates the map
build.mjs         builds everything into dist/
```

## Run it locally

You need Node 18+ and Python 3 with Pillow (`python3 -m pip install pillow`).

```sh
npm run build      # optimise photos, then build dist/
npm run dev        # build, serve at http://localhost:8080, rebuild when you save
```

`npm run dev` rebuilds on changes to the essay, template, CSS and JS. If you add or change a photo, run `npm run images` once (or `npm run build`) so the resized versions exist.

## Edit the essay

Open `content/essay.md`. It is ordinary text with a few conventions:

| You write | You get |
| --- | --- |
| A paragraph separated by a blank line | A paragraph |
| `## Chapter Title {theme=paper layout=left}` | A new chapter. `theme` sets the atmosphere (`night`, `paper`, `dusk`, `stage`, `dawn`), `layout` the heading style (`left`, `right`, `center`, `split`, `quiet`). Both are optional. |
| `> A sentence` | That sentence, set larger in italics (it stays in place in the text) |
| `>> A sentence` | That sentence, set very large |
| `*words*` | Italics, e.g. album titles |
| `**words**` | Bold |

Layout markers sit on their own line and add no words to the essay:

- `[[pair crowd-entrance]]`: the next paragraph is set beside that photo.
- `[[photo key]]`: a single photograph.
- `[[card key left]]` / `[[card key right]]`: a small saved image, like the lyric cards, set slightly askew to one side.
- `[[timeline]]`: the 2019 to 2026 interlude: the illustration of Kathmandu in 2019, the flight to New York on a map, then the Garden in 2026.
- `[[scene live]]` … `[[/scene]]`: the "Love Yourz" stage moment. The paragraphs between the markers scroll beside the photo.
- `[[peak]]`: the loudest waveform, after the high point.
- `[[filmstrip night]]`: the three-frame strip of photos whose keys start with `night-`.
- `[[closing]]`: the next paragraph becomes the final statement.

Straight quotes are turned into curly ones automatically. Nothing else about your text is changed.

## Add or replace photos

1. Put the photo in `photos/` with a descriptive file name, e.g. `kathmandu-2019.jpg`. Remove location data before committing: on iPhone, tap **Options** on the share sheet and turn off **Location**; on a Mac, Preview's **Tools → Show Inspector** can remove it.
2. In `content/photos.json`, point an entry at it and write its alt text. To show a real 2019 Nepal photo in place of the illustration, fill in the `journey-2019` entry. Until it has a file, the illustration is shown.
3. Optional: `caption` and `credit` appear under the photo. `crop` takes `[left, top, right, bottom]` fractions to use part of an image. `focus` (like `"50% 30%"`) chooses which part stays visible when a photo is cropped to fit.
4. Run `npm run build` to check it locally, then push.

The build makes 480px, 800px and full-size WebP and JPEG versions of each photo, and a 1200×630 preview image for social links (`og.jpg`, taken from the hero photo).

## Change the design

Almost everything visual is a variable in `assets/css/tokens.css`:

- **Colours:** the palette and five section themes (`--night-*`, `--paper-*`, `--dusk-*`, `--stage-*`, `--dawn-*`).
- **Type:** the three font families, body size, line height and line length (`--measure`).
- **Motion:** easing and durations. Visitors who turn on "reduce motion" in their system settings get a still version automatically.

The waveform under each chapter title gets louder through the story (quiet in 2019, loudest at "Love Yourz", a flat line at the end). The amplitudes are in `AMPS` near the top of `build.mjs`.

## The map

The Kathmandu to New York map is a real map: Natural Earth country shapes (public domain, via the `world-atlas` package) drawn in the Natural Earth projection, with the route following the great circle between the two cities. The distance shown (12,113 km, 7,527 miles) is calculated from their coordinates.

On the page, the map stays on screen while you scroll: it starts close on Nepal, a plane flies the route while the distance counts up, and it pulls back to show both cities. Readers who prefer reduced motion, or who have JavaScript off, see the finished map with the whole route.

The map is pre-drawn into `src/journey-map.svg`, so the site needs nothing extra to build. To change it (cities, labels, colours of the land), edit `scripts/make_map.mjs` and run:

```sh
npm install --no-save world-atlas@2 topojson-client@3 topojson-simplify@3 d3-geo@3
node scripts/make_map.mjs
```

## Deploy updates

Push to `main`. The workflow in `.github/workflows/deploy.yml` optimises the photos, builds the site and publishes it, usually within a couple of minutes. You can follow it in the repository's **Actions** tab. Editing `content/essay.md` directly on github.com works too.

GitHub Pages must be set to **Settings → Pages → Source: GitHub Actions** (already done for this repository).

If you rename the repository, everything keeps working because all paths are relative. Only update `url` in `content/site.json` so link previews point at the new address.
