// Builds the essay site into dist/.
//
//   node build.mjs          build once
//   node build.mjs --serve  build, serve on http://localhost:8080 and rebuild on changes
//
// Inputs: content/essay.md (the essay), content/photos.json, content/site.json,
// src/template.html, assets/ (css, js, fonts, and assets/img from scripts/optimize_images.py).
// No dependencies beyond Node 18+.

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const readJSON = (p) => JSON.parse(read(p));

// Visual identity of each chapter, in order. The essay can override theme/layout
// per chapter with {theme=... layout=...} after the heading.
// amp: how loud the waveform motif is at that point of the story.
const TRACKS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "B5", "B6"];
const AMPS = [0.55, 0.16, 0.3, 0.45, 1, 0.5, 0.72, 0.22, 0.2, 0.2];

// ---------- text helpers ----------

const escapeHTML = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeAttr = (s) => escapeHTML(s).replace(/"/g, "&quot;");

// Typographic quotes: straight ' and " become curly. Words are untouched.
function smartQuotes(s) {
  return s
    .replace(/(^|[\s(\[{—-])"/g, "$1“")
    .replace(/"/g, "”")
    .replace(/(^|[\s(\[{—-])'(?=\w)/g, (m, p1, off, str) => {
      // Leading apostrophe on a number ('03) stays an apostrophe.
      return /\d/.test(str[off + m.length]) ? p1 + "’" : p1 + "‘";
    })
    .replace(/'/g, "’");
}

function inline(md) {
  let s = escapeHTML(smartQuotes(md));
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return s;
}

const plain = (md) => smartQuotes(md.replace(/\*\*?/g, ""));

const slug = (s) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------- essay parsing ----------

function parseEssay(src) {
  const fm = {};
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (m) {
    for (const line of m[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    src = src.slice(m[0].length);
  }
  const blocks = src
    .split(/\n\s*\n/)
    .map((b) => b.trim().replace(/\s*\n\s*/g, " "))
    .filter((b) => b && !b.startsWith("<!--"));

  const chapters = [
    { title: null, label: fm["opening-label"] || "Opening", id: "opening",
      theme: fm["opening-theme"] || "night", layout: "none", blocks: [] },
  ];
  for (const b of blocks) {
    const h = b.match(/^##\s+(.+?)(?:\s+\{([^}]*)\})?$/);
    if (h) {
      const attrs = Object.fromEntries(
        (h[2] || "").split(/\s+/).filter(Boolean).map((kv) => kv.split("="))
      );
      chapters.push({ title: h[1], label: plain(h[1]), id: slug(h[1]),
        theme: attrs.theme || "night", layout: attrs.layout || "left", blocks: [] });
    } else {
      chapters[chapters.length - 1].blocks.push(b);
    }
  }
  chapters.forEach((c, i) => { c.track = TRACKS[i]; c.amp = AMPS[i]; });
  return { fm, chapters };
}

// ---------- images ----------

const photos = readJSON("content/photos.json");
let manifest = {};
try { manifest = readJSON("assets/img/manifest.json"); } catch {
  console.warn("! assets/img/manifest.json missing. Run: python3 scripts/optimize_images.py");
}

function picture(key, { sizes = "100vw", eager = false, cls = "" } = {}) {
  const p = photos[key];
  const m = manifest[key];
  if (!p || !p.file || !m) return "";
  const set = (ext) => m.widths.map((w) => `assets/img/${key}-${w}.${ext} ${w}w`).join(", ");
  const largest = m.widths[m.widths.length - 1];
  const focus = p.focus ? ` style="object-position:${escapeAttr(p.focus)}"` : "";
  return `<picture>
      <source type="image/webp" srcset="${set("webp")}" sizes="${sizes}">
      <img class="${cls}" src="assets/img/${key}-${largest}.jpg" srcset="${set("jpg")}" sizes="${sizes}"
        width="${m.width}" height="${m.height}" alt="${escapeAttr(p.alt || "")}"${focus}
        ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    </picture>`;
}

const largestSrc = (key) => {
  const m = manifest[key];
  return m ? `assets/img/${key}-${m.widths[m.widths.length - 1]}.jpg` : "";
};

function caption(key) {
  const p = photos[key] || {};
  const parts = [];
  if (p.caption) parts.push(`<span>${inline(p.caption)}</span>`);
  if (p.credit) parts.push(`<span class="credit">${inline(p.credit)}</span>`);
  return parts.length ? `<figcaption class="photo__caption">${parts.join(" ")}</figcaption>` : "";
}

const lightboxAttrs = (key) =>
  `data-lightbox="${largestSrc(key)}" data-alt="${escapeAttr(photos[key]?.alt || "")}"` +
  (photos[key]?.caption ? ` data-caption="${escapeAttr(plain(photos[key].caption))}"` : "");

// ---------- the waveform motif ----------
// A single line whose loudness follows the story: quiet in 2019, loudest at
// "Love Yourz", flat at the very end.

function wavePath(amp, seed, { w = 1000, h = 80, n = 220, grow = false, vertical = false } = {}) {
  const mid = h / 2;
  let r = seed * 9301 + 49297;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const f = [3 + rand() * 4, 11 + rand() * 9, 29 + rand() * 17, 61 + rand() * 30];
  const ph = f.map(() => rand() * Math.PI * 2);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const env = grow ? 1.35 * Math.pow(x, 1.3) * Math.min(1, (1 - x) * 14)
                     : Math.pow(Math.sin(Math.PI * x), 0.9);
    const v = 0.5 * Math.sin(x * f[0] + ph[0]) + 0.28 * Math.sin(x * f[1] + ph[1]) +
              0.15 * Math.sin(x * f[2] + ph[2]) + 0.07 * Math.sin(x * f[3] + ph[3]);
    const px = (x * w).toFixed(1);
    const py = (mid - v * env * amp * (mid - 4)).toFixed(2);
    pts.push(vertical ? `${py} ${px}` : `${px} ${py}`);
  }
  return "M" + pts.join(" L");
}

const wave = (amp, seed, cls = "wave") =>
  `<svg class="${cls}" viewBox="0 0 1000 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="${wavePath(amp, seed)}" pathLength="1"/>
    </svg>`;

// ---------- blocks ----------

function renderJourney() {
  const then = photos["journey-2019"];
  const thenFrame = then && then.file && manifest["journey-2019"]
    ? `<button class="journey__frame" type="button" ${lightboxAttrs("journey-2019")}>
        ${picture("journey-2019", { sizes: "(min-width: 900px) 30vw, 80vw", cls: "parallax-img" })}
      </button>`
    // PHOTO PLACEHOLDER: shown until a 2019 photo is set in content/photos.json ("journey-2019").
    : `<div class="journey__frame journey__frame--empty" aria-hidden="true">
        <span class="journey__devanagari" lang="ne">नेपाल</span>
        ${wave(0.12, 3, "wave wave--still")}
      </div>`;
  return `
  <section class="journey" id="journey" aria-label="2019 to 2026: from Nepal to New York" data-journey>
    <div class="journey__inner">
      <figure class="journey__stop journey__stop--then" data-reveal="rise">
        ${thenFrame}
        <figcaption>
          <span class="journey__year">2019</span>
          <span class="journey__place">Nepal</span>
          <span class="journey__line">${smartQuotes('"listening to his music for the very first time."')}</span>
        </figcaption>
      </figure>
      <div class="journey__path" aria-hidden="true">
        <svg class="journey__wave journey__wave--h" viewBox="0 0 1000 120" preserveAspectRatio="none" focusable="false">
          <path class="journey__wave-base" d="${wavePath(1, 7, { h: 120, grow: true })}"/>
          <path class="journey__wave-live" d="${wavePath(1, 7, { h: 120, grow: true })}" pathLength="1"/>
        </svg>
        <svg class="journey__wave journey__wave--v" viewBox="0 0 120 1000" preserveAspectRatio="none" focusable="false">
          <path class="journey__wave-base" d="${wavePath(1, 7, { h: 120, grow: true, vertical: true })}"/>
          <path class="journey__wave-live" d="${wavePath(1, 7, { h: 120, grow: true, vertical: true })}" pathLength="1"/>
        </svg>
        <p class="journey__span">Six years</p>
      </div>
      <ol class="journey__waypoints">
        <li style="--at:.2">Moving away from home.</li>
        <li style="--at:.4">Growing older.</li>
        <li style="--at:.6">Meeting new people.</li>
        <li style="--at:.8">Facing new responsibilities.</li>
      </ol>
      <figure class="journey__stop journey__stop--now" data-reveal="rise">
        <button class="journey__frame" type="button" ${lightboxAttrs("journey-2026")} aria-label="View photo larger">
          ${picture("journey-2026", { sizes: "(min-width: 900px) 30vw, 80vw", cls: "parallax-img" })}
        </button>
        <figcaption>
          <span class="journey__year">2026</span>
          <span class="journey__place">New York City</span>
          <span class="journey__line">${smartQuotes('"standing inside Madison Square Garden"')}</span>
        </figcaption>
      </figure>
    </div>
  </section>`;
}

function renderPhoto(key, variant = "asym") {
  return `<figure class="photo photo--${variant}" data-reveal="frame">
        <button class="photo__frame" type="button" ${lightboxAttrs(key)} aria-label="View photo larger">
          ${picture(key, { sizes: "(min-width: 1000px) 520px, 92vw", cls: "parallax-img" })}
        </button>
        ${caption(key)}
      </figure>`;
}

function renderFilmstrip(prefix) {
  const keys = Object.keys(photos).filter((k) => k.startsWith(prefix + "-") && photos[k].file);
  const frames = keys.map((k, i) => `
        <li class="filmstrip__item">
          <button class="filmstrip__frame" type="button" ${lightboxAttrs(k)} aria-label="View photo ${i + 1} of ${keys.length} larger">
            ${picture(k, { sizes: "(min-width: 1000px) 380px, 78vw" })}
          </button>
          <span class="filmstrip__no" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        </li>`).join("");
  return `<figure class="filmstrip" data-reveal="rise" aria-label="Photographs from the night">
        <ol class="filmstrip__track" data-drift>${frames}</ol>
      </figure>`;
}

function renderBlocks(blocks) {
  const out = [];
  let inScene = false;
  let closingNext = false;
  let sceneBuf = [];
  let sceneKey = "";
  let pairKey = "";
  const push = (html) => (inScene ? sceneBuf : out).push(html);

  for (const b of blocks) {
    const d = b.match(/^\[\[(\/?[\w-]+)(?:\s+([\w-]+))?\]\]$/);
    if (d) {
      const [, name, arg] = d;
      if (name === "photo") push(renderPhoto(arg));
      else if (name === "pair") pairKey = arg;
      else if (name === "peak") push(`<div class="peak" aria-hidden="true">${wave(1, 42, "wave wave--peak")}</div>`);
      else if (name === "timeline") out.push("<!--JOURNEY-->");
      else if (name === "filmstrip") push(renderFilmstrip(arg));
      else if (name === "closing") closingNext = true;
      else if (name === "scene") { inScene = true; sceneKey = arg; sceneBuf = []; }
      else if (name === "/scene") {
        inScene = false;
        out.push(`<div class="scene scene--${sceneKey}" data-scene>
        <div class="scene__media">
          <div class="scene__beam" aria-hidden="true"></div>
          <figure class="scene__photo" data-reveal="frame">
            <button class="photo__frame" type="button" ${lightboxAttrs(sceneKey)} aria-label="View photo larger">
              ${picture(sceneKey, { sizes: "(min-width: 1000px) 44vw, 100vw", cls: "parallax-img" })}
            </button>
            ${caption(sceneKey)}
          </figure>
        </div>
        <div class="scene__text">
          ${sceneBuf.join("\n          ")}
        </div>
      </div>`);
      } else console.warn(`! unknown marker [[${name}]]`);
      continue;
    }
    if (pairKey) {
      // A paragraph set beside a photograph. Reading order stays text, then photo.
      push(`<div class="pair">
        <p class="pair__text" data-reveal="statement">${inline(b)}</p>
        ${renderPhoto(pairKey, "pair")}
      </div>`);
      pairKey = "";
      continue;
    }
    if (closingNext) {
      closingNext = false;
      out.push("<!--CLOSING:" + b + "-->");
      continue;
    }
    const st = b.match(/^(>>?)\s+(.*)$/);
    if (st) {
      const big = st[1] === ">>";
      push(`<p class="statement${big ? " statement--big" : ""}" data-reveal="statement">${inline(st[2])}</p>`);
    } else {
      push(`<p>${inline(b)}</p>`);
    }
  }
  return out.join("\n      ");
}

function chapterHead(c, i) {
  if (!c.title) return "";
  let title = inline(c.title);
  if (c.layout === "split") {
    const k = c.title.indexOf(" to ");
    if (k > 0) title = `<span class="l1">${inline(c.title.slice(0, k))}</span> <span class="l2">${inline(c.title.slice(k + 1))}</span>`;
  }
  const side = c.track[0] === "A" ? "Side A" : "Side B";
  return `<header class="chapter-head">
        <p class="chapter-head__track"><span class="side">${side}</span><span class="no">${c.track}</span></p>
        <h2 class="chapter-head__title" data-reveal="title"><span>${title}</span></h2>
        ${wave(c.amp, i + 1)}
      </header>`;
}

function renderClosing(md, author) {
  const words = plain(md).split(/\s+/);
  const spans = words.map((w, i) => `<span class="w" style="--i:${i}">${escapeHTML(w)}</span>`).join(" ");
  return `
  <section class="closing theme-dawn" id="closing" aria-label="Closing">
    <div class="closing__inner">
      ${wave(0, 99, "wave wave--flat")}
      <p class="closing__statement" data-reveal="words">${spans}</p>
      <p class="signature" data-reveal="sign">
        <span class="signature__name">${escapeHTML(author)}</span>
        <svg class="signature__line" viewBox="0 0 300 24" aria-hidden="true" focusable="false"><path d="M4 16 C 60 6, 120 22, 180 12 S 270 8, 296 14" pathLength="1"/></svg>
      </p>
    </div>
  </section>`;
}

// ---------- page ----------

function build() {
  const essaySrc = read("content/essay.md");
  const site = readJSON("content/site.json");
  const { fm, chapters } = parseEssay(essaySrc);
  const title = fm.title || "Growing Up With J. Cole";
  const author = fm.author || "";

  let closingHTML = "";
  const sections = [];
  chapters.forEach((c, i) => {
    let body = renderBlocks(c.blocks);
    body = body.replace(/<!--CLOSING:([\s\S]*?)-->/, (_, md) => { closingHTML = renderClosing(md, author); return ""; });
    let journey = "";
    body = body.replace("<!--JOURNEY-->", () => { journey = "<!--J-->"; return "<!--SPLIT-->"; });
    const [before, after] = body.split("<!--SPLIT-->");
    const open = `<section class="chapter theme-${c.theme} layout-${c.layout}" id="${c.id}" data-chapter data-track="${c.track}" data-label="${escapeAttr(c.label)}" data-theme="${c.theme}" style="--amp:${c.amp}">
      ${chapterHead(c, i)}
      <div class="prose">
      ${before}
      </div>
    </section>`;
    sections.push({ theme: c.theme, html: open });
    if (journey) {
      sections.push({ theme: "night", html: renderJourney() });
      if (after && after.trim()) sections.push({ theme: c.theme, html: `<section class="chapter theme-${c.theme}"><div class="prose">${after}</div></section>` });
    }
  });
  if (closingHTML) sections.push({ theme: "dawn", html: closingHTML });

  // Soft tonal bridges where the atmosphere changes between sections.
  const parts = [];
  sections.forEach((s, i) => {
    const prev = sections[i - 1];
    // stage -> night needs no bridge: the stage light simply fades out.
    if (prev && prev.theme !== s.theme && !(prev.theme === "stage" && s.theme === "night")) {
      parts.push(`<div class="bridge bridge--${prev.theme}-${s.theme}" style="--from:var(--${prev.theme}-bg);--to:var(--${s.theme}-bg)" aria-hidden="true"></div>`);
    }
    parts.push(s.html);
  });

  const toc = (side) => chapters.filter((c) => c.track[0] === side).map((c) =>
    `<li><a href="#${c.id}" data-toc-link="${c.id}"><span class="no">${c.track}</span><span class="t">${escapeHTML(c.label)}</span></a></li>`).join("\n            ");

  const others = (site.otherEssays || []).map((e) =>
    `<a class="site-foot__link" href="${escapeAttr(e.url)}">Also by ${escapeHTML(author.split(" ")[0])}: <em>${escapeHTML(e.title)}</em></a>`).join("\n      ");

  const ogImage = new URL("assets/img/og.jpg", site.url).href;

  const html = read("src/template.html")
    .replaceAll("{{TITLE}}", escapeHTML(title))
    .replaceAll("{{TITLE_HTML}}", (() => {
      const t = escapeHTML(title);
      const k = t.indexOf(" With ");
      return k > 0
        ? `<span class="line"><span>${t.slice(0, k)}</span></span><span class="line"><span><em>With</em>${t.slice(k + 5)}</span></span>`
        : `<span class="line"><span>${t}</span></span>`;
    })())
    .replaceAll("{{SUBTITLE}}", inline(fm.subtitle || ""))
    .replaceAll("{{SUBTITLE_PLAIN}}", escapeAttr(plain(fm.subtitle || "")))
    .replaceAll("{{AUTHOR}}", escapeHTML(author))
    .replaceAll("{{DESCRIPTION}}", escapeAttr(site.description || ""))
    .replaceAll("{{URL}}", escapeAttr(site.url))
    .replaceAll("{{OG_IMAGE}}", escapeAttr(ogImage))
    .replaceAll("{{THEME_COLOR}}", escapeAttr(site.themeColor || "#100d0b"))
    .replaceAll("{{HERO_PICTURE}}", picture("hero", { sizes: "(min-width: 960px) 52vw, 100vw", eager: true, cls: "hero__img" }))
    .replaceAll("{{HERO_PRELOAD}}", manifest.hero
      ? `<link rel="preload" as="image" type="image/webp" imagesrcset="${manifest.hero.widths.map((w) => `assets/img/hero-${w}.webp ${w}w`).join(", ")}" imagesizes="(min-width: 960px) 52vw, 100vw" fetchpriority="high">`
      : "")
    .replaceAll("{{TOC_A}}", toc("A"))
    .replaceAll("{{TOC_B}}", toc("B"))
    .replaceAll("{{SECTIONS}}", parts.join("\n\n    "))
    .replaceAll("{{OTHER_ESSAYS}}", others)
    .replaceAll("{{YEAR}}", String(new Date().getFullYear()));

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, "assets"), path.join(DIST, "assets"), {
    recursive: true,
    filter: (src) => !src.endsWith("manifest.json"),
  });
  fs.writeFileSync(path.join(DIST, "index.html"), html);
  fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
  fs.writeFileSync(path.join(DIST, "404.html"),
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escapeAttr(site.url)}"><title>${escapeHTML(title)}</title><a href="${escapeAttr(site.url)}">${escapeHTML(title)}</a>`);
  const words = chapters.flatMap((c) => c.blocks).filter((b) => !b.startsWith("[[")).join(" ").split(/\s+/).length;
  console.log(`built dist/index.html: ${chapters.length} chapters, ~${words} words`);
}

build();

// ---------- dev server ----------

if (process.argv.includes("--serve")) {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
    ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".json": "application/json", ".svg": "image/svg+xml" };
  const port = Number(process.env.PORT) || 8080;
  http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(DIST, path.normalize(p));
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`serving http://localhost:${port}`));
  let t;
  for (const dir of ["content", "src", "assets/css", "assets/js"]) {
    fs.watch(path.join(ROOT, dir), { recursive: true }, () => {
      clearTimeout(t);
      t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 120);
    });
  }
}
