// Growing Up With J. Cole: scroll reveals, reading progress, contents menu,
// the Kathmandu to New York flight, the "Love Yourz" stage light, gentle photo
// parallax and the lightbox.
// No dependencies. Everything degrades to a plain, fully visible essay.

(function () {
  "use strict";

  window.__essayReady = true;

  var root = document.documentElement;
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // ---------- Scroll reveals ----------

  var revealables = $$("[data-reveal], .wave");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });
    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add("is-in"); });
  }

  // ---------- Elements driven by scroll position ----------

  var hero = $(".hero");
  var heroImg = $(".hero__img");
  var progressBar = $(".progress__bar");
  var topbar = $("[data-topbar]");
  var nowNo = $("[data-now-no]");
  var nowTitle = $("[data-now-title]");
  var chapters = $$("[data-chapter]");
  var essayStart = $("#opening");
  var essayEnd = $("#closing") || $(".essay");
  var flight = $("[data-flight]");
  var stage = $(".chapter.theme-stage");
  var scene = $("[data-scene]");
  var parallaxImgs = $$(".parallax-img");
  var drift = $("[data-drift]");
  var tocLinks = $$("[data-toc-link]");

  // ---------- Kathmandu to New York ----------
  // The page already holds a complete, still map. With motion allowed, the map is
  // held on screen while the reader scrolls: it starts close on Nepal, follows a
  // plane along the route and pulls back to show both cities. Labels, route and
  // plane are drawn at a constant size on top; only the geography zooms.

  var NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var easeInOut = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var span = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var smooth = function (x, a, b) { var u = span(x, a, b); return u * u * (3 - 2 * u); };
  var fmt = function (n) { return n.toLocaleString("en-US"); };

  function setupFlight(section) {
    var box = $("[data-map]", section);
    var map = box && $("svg.map", box);
    var routeEl = map && $("[data-route]", map);
    if (!routeEl || !map.viewBox || !map.viewBox.baseVal) return null;
    var W = map.viewBox.baseVal.width;
    var H = map.viewBox.baseVal.height;
    var initialViewBox = map.getAttribute("viewBox");

    // Route points are evenly spaced along the great circle, so position on the
    // path is also the share of the distance flown.
    var nums = (routeEl.getAttribute("d").match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    var pts = [];
    for (var i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    if (pts.length < 2) return null;
    var last = pts.length - 1;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (q) {
      minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
      minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
    });
    function along(t) {
      var f = clamp(t, 0, 1) * last;
      var k = Math.min(last - 1, Math.floor(f));
      var u = f - k;
      return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u];
    }

    section.classList.add("is-live");

    var live = svgEl("svg", { class: "journey__live", "aria-hidden": "true", focusable: "false" });
    var ahead = svgEl("path", { class: "live__ahead" }, live);
    var glow = svgEl("path", { class: "live__glow" }, live);
    var trail = svgEl("path", { class: "live__trail" }, live);
    function place(name) {
      var g = svgEl("g", { class: "live__place live__place--" + name }, live);
      svgEl("circle", { class: "live__ring", r: 6 }, g);
      svgEl("circle", { class: "live__dot", r: 5 }, g);
      return g;
    }
    var ktm = place("ktm");
    var nyc = place("nyc");
    var planeShape = $(".map__plane", map);
    var plane = svgEl("path", { class: "live__plane", d: planeShape ? planeShape.getAttribute("d") : "M12 0L-8 -7L-4 0L-8 7Z" }, live);

    var labelBox = document.createElement("div");
    labelBox.className = "journey__labels";
    labelBox.setAttribute("aria-hidden", "true");
    var labels = $$(".map__region", map).map(function (t) {
      var cls = t.getAttribute("class") || "";
      var el = document.createElement("span");
      el.className = "map-label" + (/--small/.test(cls) ? " map-label--small" : "") + (/--peak/.test(cls) ? " map-label--peak" : "");
      el.textContent = t.textContent;
      labelBox.appendChild(el);
      return { el: el, x: +t.getAttribute("x"), y: +t.getAttribute("y"), zoom: /--near/.test(cls) ? "near" : /--far/.test(cls) ? "far" : "all", o: -1 };
    });
    box.appendChild(labelBox);
    box.appendChild(live);

    var chipK = $('[data-chip="ktm"]', box);
    var chipN = $('[data-chip="nyc"]', box);
    var counters = $$("[data-count]", section).map(function (el) {
      return { el: el, total: +el.getAttribute("data-count"), shown: -1 };
    });

    function render(p) {
      var fw = box.clientWidth, fh = box.clientHeight;
      if (!fw || !fh) return;
      var mn = Math.min(fw, fh);
      box.classList.toggle("is-narrow", fw < 600);

      // Timeline over the scroll: hold on Nepal, zoom out, fly, pull back, hold.
      var t = easeInOut(span(p, 0.15, 0.8));
      var out = easeInOut(span(p, 0.03, 0.3));
      var back = easeInOut(span(p, 0.78, 0.94));

      var sNear = mn / 190;
      var sFly = Math.max(mn / 360, fw / W, fh / H);
      // Whole route in view, clear of the soft edges, with room for the city labels below the dots.
      var mx = Math.max(48, fw * 0.1), mt = Math.max(34, fh * 0.12), mb = Math.max(70, fh * 0.14);
      var bw = maxX - minX, bh = maxY - minY;
      var sAll = Math.min((fw - 2 * mx) / bw, (fh - mt - mb) / bh);
      var s1 = sNear * Math.pow(sFly / sNear, out);
      var s = s1 * Math.pow(sAll / s1, back);

      var lead = along(t + 0.05);
      var cx = pts[0][0] + (lead[0] - pts[0][0]) * out;
      var cy = pts[0][1] + (lead[1] - pts[0][1]) * out;
      cx += ((minX + maxX) / 2 - cx) * back;
      cy += (minY + bh / 2 + (mb - mt) / (2 * sAll) - cy) * back;

      // Keep the map filling the frame wherever it can.
      var hw = fw / (2 * s), hh = fh / (2 * s);
      cx = clamp(cx, Math.min(hw, W / 2), Math.max(W - hw, W / 2));
      cy = clamp(cy, Math.min(hh, H / 2), Math.max(H - hh, H / 2));
      // On a phone the whole map is shorter than the frame: sit it a little above centre.
      var spare = fh - H * s;
      if (spare > 0) cy += back * 0.18 * spare / s;
      map.setAttribute("viewBox", (cx - hw).toFixed(2) + " " + (cy - hh).toFixed(2) + " " + (2 * hw).toFixed(2) + " " + (2 * hh).toFixed(2));

      var sx = function (x) { return ((x - cx) * s + fw / 2).toFixed(1); };
      var sy = function (y) { return ((y - cy) * s + fh / 2).toFixed(1); };

      var f = t * last;
      var k = Math.floor(f);
      var here = along(t);
      var d = "M" + sx(pts[0][0]) + " " + sy(pts[0][1]);
      for (var i = 1; i <= k && i <= last; i++) d += "L" + sx(pts[i][0]) + " " + sy(pts[i][1]);
      d += "L" + sx(here[0]) + " " + sy(here[1]);
      trail.setAttribute("d", d);
      glow.setAttribute("d", d);
      var a = "M" + sx(here[0]) + " " + sy(here[1]);
      for (var j = k + 1; j <= last; j++) a += "L" + sx(pts[j][0]) + " " + sy(pts[j][1]);
      ahead.setAttribute("d", a);

      var b0 = along(t - 0.006), b1 = along(t + 0.006);
      var angle = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]) * 180 / Math.PI;
      plane.setAttribute("transform", "translate(" + sx(here[0]) + " " + sy(here[1]) + ") rotate(" + angle.toFixed(1) + ") scale(1.2)");
      plane.classList.toggle("is-flying", t > 0.002 && t < 0.997);

      var arrived = t >= 0.997;
      ktm.setAttribute("transform", "translate(" + sx(pts[0][0]) + " " + sy(pts[0][1]) + ")");
      nyc.setAttribute("transform", "translate(" + sx(pts[last][0]) + " " + sy(pts[last][1]) + ")");
      nyc.classList.toggle("is-on", arrived);
      if (chipK) { chipK.style.setProperty("--px", sx(pts[0][0]) + "px"); chipK.style.setProperty("--py", sy(pts[0][1]) + "px"); }
      if (chipN) {
        chipN.style.setProperty("--px", sx(pts[last][0]) + "px");
        chipN.style.setProperty("--py", sy(pts[last][1]) + "px");
        chipN.classList.toggle("is-on", arrived);
      }

      // Country names show close up, continents when the map is pulled back.
      var reach = mn / (2 * s);
      var near = 1 - smooth(reach, 185, 230);
      var far = smooth(reach, 190, 235);
      var roomy = smooth(s, 0.42, 0.6); // on a small screen the whole route leaves room for continents only
      labels.forEach(function (l) {
        var o = l.zoom === "near" ? near : l.zoom === "far" ? far : roomy;
        var lx = (l.x - cx) * s + fw / 2, ly = (l.y - cy) * s + fh / 2;
        o *= smooth(Math.min(lx, fw - lx), 50, 130) * smooth(Math.min(ly, fh - ly), 24, 70);
        o = Math.round(o * 100) / 100;
        if (o !== l.o) { l.el.style.setProperty("--o", o); l.o = o; }
        if (o > 0) { l.el.style.setProperty("--px", lx.toFixed(1) + "px"); l.el.style.setProperty("--py", ly.toFixed(1) + "px"); }
      });

      counters.forEach(function (c) {
        var v = Math.round(c.total * t);
        if (v !== c.shown) { c.el.textContent = fmt(v); c.shown = v; }
      });
    }

    function destroy() {
      section.classList.remove("is-live");
      live.remove();
      labelBox.remove();
      map.setAttribute("viewBox", initialViewBox);
      if (chipN) chipN.classList.remove("is-on");
      counters.forEach(function (c) { c.el.textContent = fmt(c.total); });
    }

    render(0);
    return { render: render, destroy: destroy };
  }

  var flightMap = flight && !reduceMotion ? setupFlight(flight) : null;

  // The 2019 illustration only animates while it is on screen.
  var thenStop = $(".journey__stop--then");
  if (thenStop) {
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        thenStop.classList.toggle("is-playing", entries[0].isIntersecting);
      }).observe(thenStop);
    } else {
      thenStop.classList.add("is-playing");
    }
  }


  var visible = new Set();
  if ("IntersectionObserver" in window) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
      });
      requestTick();
    }, { rootMargin: "20% 0px" });
    parallaxImgs.concat([hero, flight, stage, scene, drift]).forEach(function (el) { if (el) watch.observe(el); });
  }

  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      hero.classList.toggle("is-offscreen", !entries[0].isIntersecting);
    }).observe(hero);
  }

  var activeId = null;
  function setActive(chapter) {
    var id = chapter ? chapter.id : null;
    if (id === activeId) return;
    activeId = id;
    if (chapter) {
      nowNo.textContent = chapter.getAttribute("data-track");
      nowTitle.textContent = chapter.getAttribute("data-label");
      var theme = chapter.getAttribute("data-theme");
      topbar.setAttribute("data-tone", theme === "paper" || theme === "dawn" ? "light" : "dark");
    }
    tocLinks.forEach(function (a) {
      if (a.getAttribute("data-toc-link") === id) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  // Progress of an element through the viewport: 0 when its top reaches the
  // bottom of the screen, 1 when its bottom leaves the top.
  function through(el, vh) {
    var r = el.getBoundingClientRect();
    return clamp((vh - r.top) / (vh + r.height), 0, 1);
  }

  var ticking = false;
  function requestTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  function update() {
    ticking = false;
    var vh = window.innerHeight;
    var y = window.scrollY;

    // Reading progress across the essay itself.
    if (essayStart && essayEnd) {
      var start = essayStart.getBoundingClientRect().top + y;
      var end = essayEnd.getBoundingClientRect().bottom + y - vh;
      var p = clamp((y - start + vh * 0.5) / (end - start + vh * 0.5), 0, 1);
      progressBar.style.setProperty("--progress", p.toFixed(4));
    }

    // Top bar appears once the opening screen has mostly passed.
    var heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
    topbar.classList.toggle("is-visible", heroBottom < vh * 0.35);
    root.classList.toggle("scrolled", y > 40);

    // Current chapter: the last one whose top has passed 40% of the screen.
    var current = null;
    for (var i = 0; i < chapters.length; i++) {
      if (chapters[i].getBoundingClientRect().top < vh * 0.4) current = chapters[i];
    }
    setActive(current || chapters[0]);

    if (reduceMotion) return;

    // Hero photo drifts a little slower than the page.
    if (hero && visible.has(hero) && heroImg) {
      heroImg.style.setProperty("--hero-shift", (y * 0.12).toFixed(1) + "px");
    }

    // The flight plays out while its map is held on screen.
    if (flightMap && visible.has(flight)) {
      var fr = flight.getBoundingClientRect();
      flightMap.render(clamp(-fr.top / Math.max(1, fr.height - vh), 0, 1));
    }

    // Stage glow rises through the "Love Yourz" chapter.
    if (stage && visible.has(stage)) {
      var g = through(stage, vh);
      stage.style.setProperty("--glow", (Math.sin(Math.min(1, g * 1.6) * Math.PI / 2) * 0.45).toFixed(3));
    }
    if (scene && visible.has(scene)) {
      var s = through(scene, vh);
      scene.style.setProperty("--beam", (0.25 + Math.sin(s * Math.PI) * 0.75).toFixed(3));
    }

    // Photographs shift slightly inside their frames.
    parallaxImgs.forEach(function (img) {
      if (!visible.has(img)) return;
      var frame = img.closest("button, .hero__img-wrap") || img;
      var t = through(frame, vh) - 0.5;
      img.style.setProperty("--py", (t * -9).toFixed(2) + "%");
    });

    if (drift && visible.has(drift) && window.innerWidth >= 960) {
      drift.style.setProperty("--drift", ((through(drift, vh) - 0.5) * -60).toFixed(1) + "px");
    }
  }

  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  window.addEventListener("load", requestTick);
  if (motionQuery.addEventListener) {
    motionQuery.addEventListener("change", function (e) {
      reduceMotion = e.matches;
      if (reduceMotion && flightMap) { flightMap.destroy(); flightMap = null; }
      requestTick();
    });
  }
  update();

  // ---------- Smooth in-page navigation (respects reduced motion) ----------

  function goTo(hash) {
    var target = hash === "#top" ? document.body : $(hash);
    if (!target) return;
    var top = hash === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY - (hash === "#opening" ? 0 : 56);
    window.scrollTo({ top: top, behavior: reduceMotion ? "auto" : "smooth" });
    var focusEl = hash === "#top" ? $(".hero__title") : target;
    if (focusEl) {
      focusEl.setAttribute("tabindex", "-1");
      focusEl.focus({ preventScroll: true });
    }
    if (history.replaceState) history.replaceState(null, "", hash);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute("href");
    if (hash.length < 2) return;
    e.preventDefault();
    if (toc && toc.open) {
      toc.close();
      setTimeout(function () { goTo(hash); }, 60);
    } else {
      goTo(hash);
    }
  });

  // ---------- Contents panel ----------

  var toc = $("#toc");
  var tocOpen = $("[data-toc-open]");
  var canDialog = toc && typeof toc.showModal === "function";
  if (toc && tocOpen && canDialog) {
    tocOpen.addEventListener("click", function () {
      toc.showModal();
      tocOpen.setAttribute("aria-expanded", "true");
      var current = $('[aria-current="true"]', toc) || $("a", toc);
      if (current) current.focus();
    });
    toc.addEventListener("close", function () { tocOpen.setAttribute("aria-expanded", "false"); });
    $("[data-toc-close]", toc).addEventListener("click", function () { toc.close(); });
    toc.addEventListener("click", function (e) { if (e.target === toc) toc.close(); });
  } else if (tocOpen) {
    tocOpen.hidden = true;
  }

  // ---------- Lightbox ----------

  var lightbox = $("#lightbox");
  if (lightbox && typeof lightbox.showModal === "function") {
    var lbImg = $(".lightbox__img", lightbox);
    var lbCap = $(".lightbox__caption", lightbox);
    var opener = null;
    document.addEventListener("click", function (e) {
      var trigger = e.target.closest && e.target.closest("[data-lightbox]");
      if (!trigger) return;
      opener = trigger;
      lbImg.src = trigger.getAttribute("data-lightbox");
      lbImg.alt = trigger.getAttribute("data-alt") || "";
      lbCap.textContent = trigger.getAttribute("data-caption") || "";
      lightbox.showModal();
      $("[data-lightbox-close]", lightbox).focus();
    });
    $("[data-lightbox-close]", lightbox).addEventListener("click", function () { lightbox.close(); });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target.classList.contains("lightbox__figure")) lightbox.close();
    });
    lightbox.addEventListener("close", function () { if (opener) opener.focus({ preventScroll: true }); });
  } else {
    $$("[data-lightbox]").forEach(function (b) { b.style.cursor = "default"; });
  }
})();
