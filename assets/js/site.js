// Growing Up With J. Cole: scroll reveals, reading progress, contents menu,
// the timeline, the "Love Yourz" stage light, gentle photo parallax and the lightbox.
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
  var journey = $("[data-journey]");
  var waypoints = journey ? $$(".journey__waypoints li", journey) : [];
  var stage = $(".chapter.theme-stage");
  var scene = $("[data-scene]");
  var parallaxImgs = $$(".parallax-img");
  var drift = $("[data-drift]");
  var tocLinks = $$("[data-toc-link]");

  var visible = new Set();
  if ("IntersectionObserver" in window) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
      });
      requestTick();
    }, { rootMargin: "20% 0px" });
    parallaxImgs.concat([hero, journey, stage, scene, drift]).forEach(function (el) { if (el) watch.observe(el); });
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

    // Journey line draws itself as the section passes through the screen.
    if (journey && visible.has(journey)) {
      var r = journey.getBoundingClientRect();
      var tl = clamp((vh * 0.8 - r.top) / (r.height * 0.85), 0, 1);
      journey.style.setProperty("--tl", tl.toFixed(4));
      waypoints.forEach(function (li) {
        var at = parseFloat(li.style.getPropertyValue("--at")) || 0;
        li.classList.toggle("is-passed", tl >= at);
      });
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
    motionQuery.addEventListener("change", function (e) { reduceMotion = e.matches; requestTick(); });
  }
  if (reduceMotion && journey) {
    journey.style.setProperty("--tl", "1");
    waypoints.forEach(function (li) { li.classList.add("is-passed"); });
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
