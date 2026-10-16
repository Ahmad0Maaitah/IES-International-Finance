/* sim-core.js: small engine shared by every page of this site.
   Theme toggle (dark default, light on request), canvas plots, sliders, buttons,
   quiz wiring, deck toolbar and attribution. No dependencies. Dr Ahmad Maaitah, 2026. */
(function (global) {
  'use strict';

  /* ---------- theme: applied at parse time so a light page never flashes dark ---------- */
  var THEME_KEY = 'course-theme';
  function readTheme() { try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; } }
  function applyTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('.theme-btn').forEach(function (b) {
      b.textContent = t === 'light' ? '☾ Dark' : '☀ Light';
      b.setAttribute('aria-label', t === 'light' ? 'Switch to the dark background' : 'Switch to the light background');
    });
    SIM.colors = t === 'light' ? SIM.palettes.light : SIM.palettes.dark;
    (SIM._redraw || []).forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  function toggleTheme() {
    var next = readTheme() === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }
  global.addEventListener('storage', function (e) { if (e.key === THEME_KEY) applyTheme(readTheme()); });

  var SIM = {
    palettes: {
      dark: { bg: '#0b1220', grid: '#1e293b', axis: '#475569', text: '#94a3b8', ink: '#e2e8f0', accent: '#38bdf8', accent2: '#fbbf24', good: '#34d399', bad: '#f87171', line: '#38bdf8', muted: '#64748b' },
      light: { bg: '#0b1220', grid: '#1e293b', axis: '#475569', text: '#94a3b8', ink: '#e2e8f0', accent: '#38bdf8', accent2: '#fbbf24', good: '#34d399', bad: '#f87171', line: '#38bdf8', muted: '#64748b' }
    },
    colors: null,
    type: 1,
    _redraw: [],
    onRedraw: function (fn) { SIM._redraw.push(fn); },
    toggleTheme: toggleTheme,
    theme: readTheme
  };
  SIM.colors = SIM.palettes[readTheme() === 'light' ? 'light' : 'dark'];
  applyTheme(readTheme());

  /* ---------- seeded random ---------- */
  SIM.rng = function (seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  };

  /* ---------- formatting ---------- */
  SIM.fmt = {
    money: function (v, sym, dp) { if (dp === undefined) dp = 2; var n = Math.abs(v).toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ','); return (v < 0 ? '−' : '') + (sym || '') + n; },
    pct: function (v, dp) { if (dp === undefined) dp = 1; return (v > 0 ? '+' : (v < 0 ? '−' : '')) + Math.abs(v).toFixed(dp) + '%'; },
    num: function (v, dp) { return Number(v).toFixed(dp === undefined ? 2 : dp); }
  };

  /* ---------- canvas plot ---------- */
  function Plot(canvas, o) {
    this.cv = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    this.o = o || {};
    var dpr = global.devicePixelRatio || 1;
    this.W = this.cv.width; this.H = this.cv.height;
    this.cv.style.width = '100%';
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr);
    this.ctx = this.cv.getContext('2d');
    this.ctx.scale(dpr, dpr);
    var m = this.o.margin || {};
    var t = SIM.type;
    this.m = { l: (m.l !== undefined ? m.l : 62) * t, r: (m.r !== undefined ? m.r : 18) * t, t: (m.t !== undefined ? m.t : 34) * t, b: (m.b !== undefined ? m.b : 42) * t };
    this.xmin = this.o.xmin || 0; this.xmax = this.o.xmax === undefined ? 1 : this.o.xmax;
    this.ymin = this.o.ymin || 0; this.ymax = this.o.ymax === undefined ? 1 : this.o.ymax;
  }
  Plot.prototype.font = function (px, weight) { return (weight || 400) + ' ' + Math.round(px * SIM.type) + 'px ' + '"Segoe UI", system-ui, sans-serif'; };
  Plot.prototype.xpix = function (x) { return this.m.l + (x - this.xmin) / (this.xmax - this.xmin) * (this.W - this.m.l - this.m.r); };
  Plot.prototype.ypix = function (y) { return this.H - this.m.b - (y - this.ymin) / (this.ymax - this.ymin) * (this.H - this.m.t - this.m.b); };
  Plot.prototype.clear = function () {
    var g = this.ctx, C = SIM.colors;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); g.restore();
    g.fillStyle = C.bg; g.fillRect(0, 0, this.W, this.H);
    if (this.o.title) { g.fillStyle = C.ink; g.font = this.font(15, 700); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(this.o.title, this.m.l, 8 * SIM.type); }
  };
  Plot.prototype.axes = function (opts) {
    opts = opts || {};
    var g = this.ctx, C = SIM.colors, i;
    var x0 = this.m.l, x1 = this.W - this.m.r, y0 = this.H - this.m.b, y1 = this.m.t;
    g.strokeStyle = C.grid; g.lineWidth = 1;
    var yt = opts.yticks || 5;
    g.font = this.font(12); g.fillStyle = C.text; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (i = 0; i <= yt; i++) {
      var yv = this.ymin + (this.ymax - this.ymin) * i / yt, yp = this.ypix(yv);
      g.beginPath(); g.moveTo(x0, yp); g.lineTo(x1, yp); g.stroke();
      g.fillText(opts.yfmt ? opts.yfmt(yv) : (Math.round(yv * 100) / 100), x0 - 8, yp);
    }
    if (!opts.noxticks) {
      var xt = opts.xticks || 5;
      g.textAlign = 'center'; g.textBaseline = 'top';
      for (i = 0; i <= xt; i++) {
        var xv = this.xmin + (this.xmax - this.xmin) * i / xt, xp = this.xpix(xv);
        g.fillText(opts.xfmt ? opts.xfmt(xv) : (Math.round(xv * 100) / 100), xp, y0 + 6);
      }
    }
    g.strokeStyle = C.axis; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x0, y0); g.lineTo(x1, y0); g.stroke();
    g.fillStyle = C.text; g.font = this.font(12);
    if (this.o.xlabel) { g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(this.o.xlabel, (x0 + x1) / 2, this.H - 4); }
    if (this.o.ylabel) { g.save(); g.translate(14 * SIM.type, (y0 + y1) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.o.ylabel, 0, 0); g.restore(); }
  };
  Plot.prototype.line = function (xs, ys, o) {
    o = o || {}; var g = this.ctx; g.strokeStyle = o.color || SIM.colors.line; g.lineWidth = o.width || 2.2; g.setLineDash(o.dash || []);
    g.beginPath(); for (var i = 0; i < xs.length; i++) { var x = this.xpix(xs[i]), y = this.ypix(ys[i]); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.setLineDash([]);
  };
  Plot.prototype.hline = function (y, o) { o = o || {}; var g = this.ctx; g.strokeStyle = o.color || SIM.colors.accent2; g.lineWidth = o.width || 1.5; g.setLineDash(o.dash || [6, 4]); g.beginPath(); g.moveTo(this.m.l, this.ypix(y)); g.lineTo(this.W - this.m.r, this.ypix(y)); g.stroke(); g.setLineDash([]); if (o.label) this.label(this.xmax, y, o.label, { align: 'right', color: o.color || SIM.colors.accent2, dy: -6 }); };
  Plot.prototype.vline = function (x, o) { o = o || {}; var g = this.ctx; g.strokeStyle = o.color || SIM.colors.accent2; g.lineWidth = o.width || 1.5; g.setLineDash(o.dash || [6, 4]); g.beginPath(); g.moveTo(this.xpix(x), this.m.t); g.lineTo(this.xpix(x), this.H - this.m.b); g.stroke(); g.setLineDash([]); };
  Plot.prototype.bars = function (items, o) {
    /* items: [{label, value, color, note}] drawn as vertical bars across the x range */
    o = o || {}; var g = this.ctx, n = items.length, C = SIM.colors;
    var x0 = this.m.l, x1 = this.W - this.m.r, w = (x1 - x0) / n, bw = w * (o.width || 0.62);
    for (var i = 0; i < n; i++) {
      var it = items[i], cx = x0 + w * (i + 0.5), top = this.ypix(Math.max(0, it.value)), base = this.ypix(Math.min(0, it.value));
      g.fillStyle = it.color || C.accent; g.fillRect(cx - bw / 2, top, bw, Math.max(1, base - top));
      g.fillStyle = C.text; g.font = this.font(o.labelSize || 12); g.textAlign = 'center'; g.textBaseline = 'top';
      var ly = this.ypix(0) + 6; if (it.labelBelow === false) ly = this.H - this.m.b + 6;
      g.fillText(it.label, cx, o.labelsAtBottom ? this.H - this.m.b + 6 : ly);
      if (it.note !== undefined) { g.fillStyle = it.noteColor || C.ink; g.font = this.font(o.noteSize || 12, 700); g.textBaseline = it.value >= 0 ? 'bottom' : 'top'; g.fillText(it.note, cx, it.value >= 0 ? top - 4 : base + 4); }
    }
  };
  Plot.prototype.label = function (x, y, text, o) { o = o || {}; var g = this.ctx; g.fillStyle = o.color || SIM.colors.ink; g.font = this.font(o.size || 12, o.weight || 600); g.textAlign = o.align || 'left'; g.textBaseline = o.baseline || 'bottom'; g.fillText(text, this.xpix(x) + (o.dx || 0), this.ypix(y) + (o.dy || 0)); };
  Plot.prototype.text = function (px, py, text, o) { o = o || {}; var g = this.ctx; g.fillStyle = o.color || SIM.colors.ink; g.font = this.font(o.size || 12, o.weight || 600); g.textAlign = o.align || 'left'; g.textBaseline = o.baseline || 'alphabetic'; g.fillText(text, px, py); };
  Plot.prototype.legend = function (items, o) {
    o = o || {}; var g = this.ctx, x = this.m.l + (o.dx || 10), y = this.m.t + (o.dy || 10);
    g.font = this.font(12); g.textAlign = 'left'; g.textBaseline = 'middle';
    items.forEach(function (it) { g.fillStyle = it.color; g.fillRect(x, y - 5, 14, 10); g.fillStyle = SIM.colors.text; g.fillText(it.label, x + 20, y); y += 18 * SIM.type; });
  };
  SIM.Plot = Plot;

  /* ---------- controls ---------- */
  SIM.slider = function (container, cfg, onChange) {
    var wrap = document.createElement('div'); wrap.className = 'ctl';
    var lab = document.createElement('label'); lab.textContent = cfg.label; wrap.appendChild(lab);
    var inp = document.createElement('input'); inp.type = 'range'; inp.min = cfg.min; inp.max = cfg.max; inp.step = cfg.step || 1; inp.value = cfg.value; inp.setAttribute('aria-label', cfg.label); wrap.appendChild(inp);
    var val = document.createElement('span'); val.className = 'val'; wrap.appendChild(val);
    var fmt = cfg.fmt || function (v) { return v; };
    function show() { val.textContent = fmt(parseFloat(inp.value)); }
    inp.addEventListener('input', function () { show(); onChange(parseFloat(inp.value)); });
    show(); container.appendChild(wrap);
    return {
      get: function () { return parseFloat(inp.value); },
      set: function (v) { inp.value = v; show(); onChange(parseFloat(inp.value)); },
      /* exact value for presets: the thumb snaps to the step grid, the number does not */
      setExact: function (v) { inp.value = v; val.textContent = fmt(v); onChange(v); },
      el: inp
    };
  };
  SIM.button = function (container, label, onClick, cls) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = label; b.addEventListener('click', onClick); container.appendChild(b); return b;
  };
  SIM.number = function (container, cfg, onChange) {
    var wrap = document.createElement('div'); wrap.className = 'ctl'; wrap.style.flex = '0 0 auto';
    var lab = document.createElement('label'); lab.textContent = cfg.label; wrap.appendChild(lab);
    var inp = document.createElement('input'); inp.type = 'number'; inp.step = cfg.step || 0.01; inp.min = cfg.min || 0; inp.value = cfg.value; inp.setAttribute('aria-label', cfg.label); wrap.appendChild(inp);
    inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (!isNaN(v) && v > 0) onChange(v); });
    container.appendChild(wrap);
    return { get: function () { return parseFloat(inp.value); }, set: function (v) { inp.value = v; onChange(v); }, el: inp };
  };

  /* ---------- quiz ---------- */
  SIM.initQuiz = function (root) {
    (root || document).querySelectorAll('.quiz').forEach(function (q) {
      if (q.dataset.wired) return; q.dataset.wired = '1';
      q.querySelectorAll('.opt').forEach(function (o) {
        o.setAttribute('role', 'button'); o.setAttribute('tabindex', '0');
        function pick() {
          if (q.classList.contains('answered')) return;
          q.classList.add('answered');
          q.querySelectorAll('.opt').forEach(function (x) { if (x.hasAttribute('data-ok')) x.classList.add('correct'); });
          if (!o.hasAttribute('data-ok')) o.classList.add('wrong');
        }
        o.addEventListener('click', pick);
        o.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
    });
  };

  /* ---------- full screen: clean slides while presenting ---------- */
  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  SIM.toggleFullscreen = function () {
    var el = document.documentElement;
    if (fsElement()) { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); }
    else if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  };
  var fsButtons = [], fsTimer = null;
  function setChrome(hidden) { document.body.classList.toggle('chrome-hidden', hidden); }
  function fsSleepSoon() { clearTimeout(fsTimer); fsTimer = setTimeout(function () { if (fsElement()) setChrome(true); }, 2600); }
  function fsWake() { if (!fsElement()) return; setChrome(false); fsSleepSoon(); }
  function fsChanged() {
    var on = !!fsElement();
    fsButtons.forEach(function (b) { b.textContent = on ? '⤢ Exit full screen' : '⤢ Full screen'; b.title = on ? 'Exit full screen (f)' : 'Full screen (f)'; });
    clearTimeout(fsTimer); setChrome(false);
    if (on) fsSleepSoon();
  }
  document.addEventListener('fullscreenchange', fsChanged);
  document.addEventListener('webkitfullscreenchange', fsChanged);
  global.addEventListener('mousemove', fsWake);
  global.addEventListener('touchstart', fsWake, { passive: true });

  /* ---------- deck chrome ---------- */
  SIM.initDeck = function (cfg) {
    cfg = cfg || {};
    var plugins = [];
    if (global.RevealNotes) plugins.push(RevealNotes);
    var lean = !!document.querySelector('.reveal.lean');
    Reveal.initialize({ hash: true, slideNumber: 'c/t', width: 1050, height: 700, margin: 0.04, minScale: 0.2, maxScale: 2.0, controls: false, progress: true, center: lean, transition: 'slide', plugins: plugins });
    /* toolbar */
    var nav = document.createElement('div'); nav.className = 'deck-nav'; nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'Deck tools');
    var hub = document.createElement('a'); hub.href = cfg.hub || '../index.html'; hub.textContent = '⌂ Hub'; nav.appendChild(hub);
    if (cfg.links) cfg.links.forEach(function (l) { var a = document.createElement('a'); a.href = l.href; a.textContent = l.label; nav.appendChild(a); });
    var sep = document.createElement('span'); sep.className = 'sep'; nav.appendChild(sep);
    function mk(label, title, fn) { var b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.addEventListener('click', fn); nav.appendChild(b); return b; }
    mk('←', 'Previous slide', function () { Reveal.prev(); });
    mk('→', 'Next slide', function () { Reveal.next(); });
    mk('⬚ Overview', 'Overview (o)', function () { Reveal.toggleOverview(); });
    fsButtons.push(mk('⤢ Full screen', 'Full screen (f)', function () { SIM.toggleFullscreen(); }));
    var tb = mk('', 'Light or dark background', function () { SIM.toggleTheme(); }); tb.className = 'theme-btn';
    document.body.appendChild(nav);
    applyTheme(readTheme());
    /* attribution */
    var at = document.createElement('div'); at.className = 'deck-attrib'; at.textContent = '© 2026 Dr Ahmad Maaitah · FI 355 International Finance'; document.body.appendChild(at);
    SIM.initQuiz();
  };

  /* ---------- page chrome ---------- */
  SIM.initPage = function () {
    document.querySelectorAll('.theme-btn').forEach(function (b) { b.addEventListener('click', SIM.toggleTheme); });
    applyTheme(readTheme());
  };

  global.SIM = SIM;
})(window);
