// Generates src/journey-map.svg: the Kathmandu to New York map on the timeline.
// Run only when changing the map. It needs three packages that the site itself doesn't:
//
//   npm install --no-save world-atlas@2 topojson-client@3 topojson-simplify@3 d3-geo@3
//   node scripts/make_map.mjs
//
// Map data: Natural Earth (public domain) via world-atlas, 1:50m.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { geoNaturalEarth1, geoPath, geoGraticule, geoInterpolate, geoDistance } from "d3-geo";
import { feature, mesh } from "topojson-client";
import { presimplify, simplify, quantile } from "topojson-simplify";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Keep the most significant quarter of the coastline points (keeps the inlined SVG light).
const topo = presimplify(require("world-atlas/countries-50m.json"));
const world = simplify(topo, quantile(topo, 0.25));

// A small airliner seen from above, nose pointing along +x.
const PLANE = "M14 0 L4 -2.2 L-3 -11 L-6.5 -11 L-1.5 -2.2 L-8 -1.6 L-10.5 -5 L-13 -5 L-11 0 L-13 5 L-10.5 5 L-8 1.6 L-1.5 2.2 L-6.5 11 L-3 11 L4 2.2 Z";

const KATHMANDU = [85.324, 27.7172];
const NEW_YORK = [-74.006, 40.7128];
const EARTH_RADIUS_KM = 6371.0088;

const W = 1600;
const H = 760;

const countries = feature(world, world.objects.countries);
const landFull = feature(world, world.objects.land);
// Borders are hairlines, so the 1:110m set is plenty. Nepal's own outline (1:50m) draws its borders.
const coarse = require("world-atlas/countries-110m.json");
const borders = mesh(coarse, coarse.objects.countries, (a, b) => a !== b && Number(a.id) !== 524 && Number(b.id) !== 524);
const byId = (id) => countries.features.find((f) => Number(f.id) === id);
const nepal = byId(524);
const usa = byId(840);

const interp = geoInterpolate(KATHMANDU, NEW_YORK);
const routeCoords = Array.from({ length: 241 }, (_, i) => interp(i / 240));
const route = { type: "LineString", coordinates: routeCoords };

// Frame the North Atlantic, Europe and South Asia, with room for the polar arc.
const frame = { type: "MultiPoint", coordinates: [[-112, 8], [104, 8], [-112, 78], [104, 78], ...routeCoords] };
const projection = geoNaturalEarth1().rotate([-8, 0]).fitExtent([[40, 30], [W - 40, H - 20]], frame);
projection.clipExtent([[0, 0], [W, H]]);
const pathOf = geoPath(projection).digits(0);

// Keep only polygons big enough to see; drop specks and anything off-frame.
const polygonsOf = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
const keepVisible = (geoms, minArea) => ({
  type: "MultiPolygon",
  coordinates: geoms.filter((rings) => pathOf.area({ type: "Polygon", coordinates: rings }) >= minArea),
});
const land = keepVisible(landFull.features ? landFull.features.flatMap(polygonsOf) : polygonsOf(landFull), 5);
// The contiguous United States only: Alaska and Hawaii would sit off the edge of the frame.
const usaMain = keepVisible(polygonsOf(usa).filter((rings) => rings[0].every(([lon, lat]) => lon > -130 && lat < 50)), 1);

const km = Math.round(geoDistance(KATHMANDU, NEW_YORK) * EARTH_RADIUS_KM);
const miles = Math.round(km * 0.621371);
const [kx, ky] = projection(KATHMANDU).map((v) => +v.toFixed(1));
const [nx, ny] = projection(NEW_YORK).map((v) => +v.toFixed(1));

// Static plane for the version without animation: halfway along the route, pointing along it.
const mid = projection(interp(0.5));
const ahead = projection(interp(0.51));
const planeAngle = (Math.atan2(ahead[1] - mid[1], ahead[0] - mid[0]) * 180) / Math.PI;

// Labels. "far" ones read on the full map, "near" ones only when the animation zooms in,
// "all" ones in both. The animated version moves them into HTML so they stay a constant size.
const label = (name, lon, lat, zoom, extra = "") => {
  const p = projection([lon, lat]);
  return p ? `<text class="map__region map__region--${zoom}${extra}" x="${p[0].toFixed(0)}" y="${p[1].toFixed(0)}">${name}</text>` : "";
};
const EVEREST = [86.925, 27.988];
const [ex, ey] = projection(EVEREST).map((v) => +v.toFixed(1));

const routeD = geoPath(projection).digits(1)(route);

const svg = `<svg class="map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="map-title map-desc" data-km="${km}" data-miles="${miles}">
  <title id="map-title">From Kathmandu to New York</title>
  <desc id="map-desc">A map of the northern hemisphere. A dotted route arcs ${km.toLocaleString("en-US")} kilometres from Kathmandu, Nepal, north over Central Asia, the Arctic and Greenland, to New York City.</desc>
  <defs>
    <linearGradient id="map-land" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a2f25"/>
      <stop offset="1" stop-color="#271f18"/>
    </linearGradient>
    <radialGradient id="map-glow">
      <stop offset="0" stop-color="#e9b26b" stop-opacity=".55"/>
      <stop offset="1" stop-color="#e9b26b" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="map-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000"/>
      <stop offset=".08" stop-color="#fff"/>
      <stop offset=".72" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="map-edge" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#map-fade)"/></mask>
  </defs>
  <g class="map__geo" mask="url(#map-edge)">
    <path class="map__graticule" d="${pathOf(geoGraticule().step([15, 15])())}"/>
    <path class="map__land" d="${pathOf(land)}"/>
    <path class="map__borders" d="${geoPath(projection).digits(1)(borders)}"/>
    <path class="map__country map__country--usa" d="${pathOf(usaMain)}"/>
    <path class="map__country map__country--nepal" d="${geoPath(projection).digits(1)(nepal)}"/>
  </g>
  <g class="map__labels">
    ${label("NORTH AMERICA", -102, 51, "far")}
    ${label("EUROPE", 14, 52, "far")}
    ${label("ASIA", 96, 50, "far")}
    ${label("ATLANTIC OCEAN", -38, 30, "all")}
    ${label("ARCTIC OCEAN", 16, 81.5, "all")}
    ${label("GREENLAND", -40, 79.2, "all")}
    ${label("RUSSIA", 96, 62, "near")}
    ${label("KAZAKHSTAN", 64, 47.5, "near")}
    ${label("CHINA", 99, 35, "near")}
    ${label("INDIA", 78.5, 21.5, "near")}
    ${label("CANADA", -100, 58, "near")}
    ${label("UNITED STATES", -98, 39, "near")}
    ${label("Himalaya", 90.6, 30.4, "near", " map__region--small")}
    <text class="map__region map__region--near map__region--peak" x="${ex}" y="${ey}">Everest</text>
  </g>
  <g class="map__static">
    <path class="map__route" d="${routeD}" data-route/>
    <g class="map__place map__place--ktm" transform="translate(${kx} ${ky})">
      <circle class="map__halo" r="38" fill="url(#map-glow)"/>
      <circle class="map__dot" r="5"/>
    </g>
    <g class="map__place map__place--nyc" transform="translate(${nx} ${ny})">
      <circle class="map__halo" r="38" fill="url(#map-glow)"/>
      <circle class="map__dot" r="5"/>
    </g>
    <path class="map__plane" transform="translate(${mid[0].toFixed(1)} ${mid[1].toFixed(1)}) rotate(${planeAngle.toFixed(1)})" d="${PLANE}"/>
  </g>
</svg>
`;

fs.writeFileSync(path.join(ROOT, "src", "journey-map.svg"), svg);
fs.writeFileSync(path.join(ROOT, "src", "journey-map.json"), JSON.stringify({ km, miles, ktm: [kx, ky], nyc: [nx, ny], everest: [ex, ey], width: W, height: H }, null, 2));
console.log(`map: ${km} km / ${miles} mi, Kathmandu at ${kx},${ky}, New York at ${nx},${ny}, ${(svg.length / 1024).toFixed(0)} KB`);
