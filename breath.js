/* Breath: the instrument at /breath.
 *
 * The icons run along the top, as on the Story Map: your takes, the recorder (arm, record, pause, stop, or
 * play, pause, stop for a take) with its clock, the shape, the dial's time, the guide's pace, and the ear.
 * Below them, two windows. Above, the gauge: a circle that fills while you breathe in and empties as you
 * breathe out, a pen that writes the breath around a turning dial, and one button at its heart. Below, the
 * shape (a bellows, lungs, a balloon, an accordion, a tide, a jellyfish) that breathes with you, with a
 * take, or on its own once the guide is started.
 *
 * The breath comes from the hand (hold the lower window, or the space bar) and from the ear: the microphone
 * hears the sound of air, each breath it hears turns the other way from the last, speaking counts as
 * breathing out, and the lungs rest where they are in the quiet between. The hand always has the last word.
 *
 * The recorder is the Dream Journal's own (sdj-stage.js, SDJStage.record), copied here because it lives on
 * the Playground's domain: arm opens the microphone and the circle shows its levels, record starts the
 * MediaRecorder, pause and resume, stop finishes. Listening uses the Dream Journal's play and pause, with stop.
 *
 * A take keeps two things together: the voice, and the imprint of the breath, which is a list of
 * [ms since record began, 1 in | 0 out | 2 resting] with paused time left out. Upon playback the imprint
 * drives the circle and the shape in step with the audio's own clock. Each imprint carries its own model,
 * so takes made before the breath was slowed replay as they were made.
 *
 * Saved to Supabase: audio in the private bucket 'breath' at <uid>/<take id>.<ext>, the row in breath_takes.
 * Sign-in is asked for only when a take is stopped, through the one sign-in window (shared/signin.js).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://local-supabase.invalid';
  var SUPABASE_ANON = 'local';
  var BUCKET = 'breath', TABLE = 'breath_takes';
  var TAU = Math.PI * 2, TOP = -Math.PI / 2;
  var LIMIT_MS = 15 * 60000;                      // the Dream Journal's fifteen minutes
  var MODEL = { in: 0.85, out: 0.66, hold: 2.4 }; // slow and smooth: about five seconds to fill, six to empty
  var REC_RED = '#ff5046';
  var DIALS = [20000, 40000, 60000, 120000, 300000];
  var PACES = [
    { id: 'calm', name: '4 · 6', word: 'calm', ph: [4, 0, 6, 0] },
    { id: 'box', name: '4 · 4 · 4 · 4', word: 'box', ph: [4, 4, 4, 4] },
    { id: 'deep', name: '4 · 7 · 8', word: 'deep', ph: [4, 7, 8, 0] },
    { id: 'even', name: '5.5 · 5.5', word: 'even', ph: [5.5, 0, 5.5, 0] }
  ];
  var SH = window.BREATH_SHAPES;

  var doc = document.documentElement;
  var params = new URLSearchParams(location.search);
  if (params.get('embed') === '1') doc.classList.add('embed');

  /* what this device remembers: the shape, the dial's time, the guide's pace */
  var PREF_KEY = 'breath-prefs', pref = { shape: 'bellows', dial: 60000, pace: 'calm' };
  try { var saved = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); if (saved && typeof saved === 'object') Object.keys(pref).forEach(function (k) { if (saved[k] != null) pref[k] = saved[k]; }); } catch (e) {}
  if (SH.list.indexOf(pref.shape) < 0) pref.shape = 'bellows';
  if (DIALS.indexOf(+pref.dial) < 0) pref.dial = 60000;
  pref.dial = +pref.dial;
  if (!PACES.some(function (p) { return p.id === pref.pace; })) pref.pace = 'calm';
  function keepPref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) {} }
  var REV_MS = pref.dial;
  function paceNow() { return PACES.filter(function (p) { return p.id === pref.pace; })[0] || PACES[0]; }

  function $(s) { return document.querySelector(s); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clock(ms) { var s = Math.floor(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function secs(ms) { return (ms / 1000).toFixed(1) + ' s'; }
  function dialName(ms) { return ms < 60000 ? (ms / 1000) + ' s' : (ms / 60000) + ' min'; }
  function dialShort(ms) { return ms < 60000 ? (ms / 1000) + 's' : (ms / 60000) + 'm'; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 256; });
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ── the skin's ink ─────────────────────────────────────────────── */
  var K = {};
  function readInk() {
    var s = getComputedStyle(doc);
    function v(n, d) { return (s.getPropertyValue(n) || '').trim() || d; }
    K.amber = v('--amber', '#ffd24d'); K.ink = v('--ink', 'rgba(236,236,230,.82)');
    K.mid = v('--ink-mid', 'rgba(236,236,230,.44)'); K.lo = v('--ink-lo', 'rgba(236,236,230,.2)');
    K.plate = v('--plate', '#0e0f0d');
    K.dark = ['studio', 'paper'].indexOf(doc.dataset.skin) < 0;
    K.font = getComputedStyle(document.body).fontFamily || 'monospace';
    K.studio = doc.dataset.skin === 'studio';
  }
  /* from sdj-stage.js */
  function rgba(hex, a) {
    var h = (hex || '').trim();
    if (h.indexOf('rgb') === 0) return h.replace(/rgba?\(([^)]+)\)/, function (m, inner) {
      var p = inner.split(',').map(function (x) { return x.trim(); });
      return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
    });
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!m) return 'rgba(255,210,77,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  /* ── the breath: lungs that fill toward 1 breathing in, empty toward 0 breathing out, and rest where
     they are in between. Critically damped, in closed form, so the live circle and a replayed imprint
     move identically. ── */
  function settle(x, v, target, w, dt) {
    var A = x - target, B = v + w * A, e = Math.exp(-w * dt);
    return [target + (A + B * dt) * e, (B - w * (A + B * dt)) * e];
  }
  function curve(events, model) {
    var Mo = model || MODEL, ks = [], x = 0, v = 0, t = 0, target = 0, w = Mo.out;
    (events || []).forEach(function (e) {
      var dt = (e[0] - t) / 1000;
      if (dt > 0) { var r = settle(x, v, target, w, dt); x = r[0]; v = r[1]; t = e[0]; }
      if (e[1] === 2) { target = clamp01(x); w = Mo.hold || 2.4; }
      else { target = e[1] ? 1 : 0; w = e[1] ? Mo.in : Mo.out; }
      ks.push({ t: t, x: x, v: v, target: target, w: w });
    });
    if (!ks.length) ks.push({ t: 0, x: 0, v: 0, target: 0, w: Mo.out });
    ks.model = Mo;
    return ks;
  }
  function xAt(ks, ms) {
    if (ms <= ks[0].t) return ks[0].x;
    var lo = 0, hi = ks.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (ks[mid].t <= ms) lo = mid; else hi = mid - 1; }
    var k = ks[lo];
    return clamp01(settle(k.x, k.v, k.target, k.w, (ms - k.t) / 1000)[0]);
  }
  function summarize(events, D) {
    var ins = [], outs = [], breaths = 0, seenIn = false;
    for (var i = 0; i < events.length; i++) {
      var e = events[i], nx = events[i + 1];
      if (e[1] === 1) { breaths++; seenIn = true; }
      if (!nx) break;
      var d = nx[0] - e[0];
      if (d <= 0) continue;
      if (e[1] === 1) ins.push(d); else if (e[1] === 0 && seenIn) outs.push(d);
    }
    function avg(a) { return a.length ? Math.round(a.reduce(function (s, x) { return s + x; }, 0) / a.length) : null; }
    return { ins: ins, outs: outs, breaths: breaths, avgIn: avg(ins), avgOut: avg(outs), D: D };
  }
  function ksOf(t) {
    if (!t.ks) { var im = t.imprint || {}; t.ks = curve(im.events || [], im.model); }
    return t.ks;
  }

  /* ── the frames, drawn in hairlines ─────────────────────────────── */
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return 'M' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) +
      'A' + r + ' ' + r + ' 0 0 1 ' + (x + w - r) + ' ' + (y + h) + 'H' + (x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + (y + h - r) +
      'V' + (y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + 'Z';
  }
  function framed(el, k0) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'frame'); svg.setAttribute('aria-hidden', 'true');
    el.insertBefore(svg, el.firstChild);
    function paint() {
      var w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
      var R = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      svg.innerHTML = '<path d="' + rr(0.75, 0.75, w - 1.5, h - 1.5, R) + '" pathLength="1" style="--k:' + k0 + '"/>' +
        '<path d="' + rr(6.5, 6.5, w - 13, h - 13, Math.max(2, R - 5)) + '" pathLength="1" style="--k:' + (k0 + 0.16) + '"/>';
    }
    paint();
    if (window.ResizeObserver) new ResizeObserver(paint).observe(el);
    else window.addEventListener('resize', paint);
  }

  /* ── the page ───────────────────────────────────────────────────── */
  var gauge = $('#gauge'), pad = $('#pad'), stage = $('#stage'), hub = $('#hub');
  var cv = $('#cv'), ctx = cv.getContext('2d');
  var bel = $('#bellows'), bctx = bel.getContext('2d');
  var railEl = $('#rail'), readEl = $('#readout'), clockEl = $('#clock'), lampEl = $('#lamp');
  var bar = $('#topbar'), tbSet = $('#tbSet'), trayEl = $('#tray'), tipEl = $('#tbTip');
  var tbTakes = $('#tbTakes'), tbArm = $('#tbArm'), tbRec = $('#tbRec'), tbPause = $('#tbPause'), tbStop = $('#tbStop');
  var tbPlay = $('#tbPlay'), tbLPause = $('#tbLPause'), tbLStop = $('#tbLStop');
  var tbShape = $('#tbShape'), tbDial = $('#tbDial'), tbPace = $('#tbPace'), tbEar = $('#tbEar');
  var plateEl = $('#plate'), padGo = $('#padGo'), padPace = $('#padPace'), sayLine = $('#sayLine');
  var SAY0 = sayLine.textContent;
  readInk();
  framed(gauge, 0);
  framed(pad, 0.12);
  Array.prototype.forEach.call(tbSet.children, function (el, i) { el.style.setProperty('--i', i); });

  /* ── the glyphs, and the one button at the heart of the circle ──── */
  var GLYPH = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    rec: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/><path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>'
  };
  var core = document.createElement('button');
  core.type = 'button'; core.id = 'core';
  hub.appendChild(core);

  var geo = { S: 300, C: 150, dpr: 1, rMin: 40, rMax: 124 };
  var bgeo = { W: 300, H: 200, dpr: 1, top: 56, bottom: 160 };
  function layout() {
    var r = stage.getBoundingClientRect();
    var S = Math.max(150, Math.floor(Math.min(r.width - 12, r.height)));
    var Wc = Math.max(S, Math.floor(Math.min(r.width, S + 90)));
    var dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    cv.style.width = Wc + 'px'; cv.style.height = S + 'px';
    cv.width = Math.round(Wc * dpr); cv.height = Math.round(S * dpr);
    /* the circle may close almost to the button at its heart, and open out to the dial */
    var cr = (core.offsetWidth || 54) / 2;
    var rMax = Math.min(S / 2 - 27, Wc / 2 - 46), rMin = Math.min(rMax - 30, cr + 11);
    geo = { S: S, W: Wc, ox: (Wc - S) / 2, C: S / 2, dpr: dpr, rMin: rMin, rMax: rMax };
    impCache.id = null;
    var pr = pad.getBoundingClientRect(), say = pad.querySelector('.say').getBoundingClientRect(), go = padGo.getBoundingClientRect();
    bel.width = Math.round(pr.width * dpr); bel.height = Math.round(pr.height * dpr);
    bgeo = { W: pr.width, H: pr.height, dpr: dpr, top: Math.max(30, go.bottom - pr.top + 6), bottom: say.top - pr.top - 8 };
  }
  function rOf(x) { return geo.rMin + clamp01(x) * (geo.rMax - geo.rMin); }

  /* ── the breath, from the hand and from the ear ─────────────────── */
  var held = false, live = { x: 0, v: 0, target: 0, w: MODEL.out }, bstate = 0;
  var trail = [], liveEpoch = performance.now(), lastPush = 0;
  var inAt = null, outAt = null, lastIn = null, lastOut = null;
  var pointers = {}, spaceDown = false;

  function setBreath(s, src) {
    if (s === bstate) return;
    var now = performance.now();
    if (bstate === 1 && inAt != null) { lastIn = now - inAt; inAt = null; }
    if (bstate === 0 && outAt != null) { lastOut = now - outAt; outAt = null; }
    if (s === 1) inAt = now; else if (s === 0 && lastIn != null) outAt = now;
    bstate = s;
    if (s === 2) { live.target = live.x; live.w = MODEL.hold; }
    else { live.target = s; live.w = s ? MODEL.in : MODEL.out; }
    if (state === 'recording' && imp) { imp.events.push([Math.round(recMs()), s]); if (src) imp.src[src] = true; }
  }
  function setHold(h) {
    if (h === held) return;
    held = h;
    pad.classList.toggle('held', h);
    setBreath(h ? 1 : 0, 'hand');
    /* the hand puts the ear right: what it hears next is the other half of this breath */
    if (ear.on) { ear.expect = h ? 0 : 1; if (ear.seg && ear.seg.kind && ear.seg.kind !== 'voice') ear.seg.kind = h ? 'in' : 'out'; }
  }
  function anyPointer() { for (var k in pointers) if (pointers[k]) return true; return false; }
  pad.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || e.target.closest('#padGo')) return;
    e.preventDefault();
    closeTray();
    try { pad.setPointerCapture(e.pointerId); } catch (x) {}
    pointers[e.pointerId] = true; setHold(true);
  });
  function lift(e) { delete pointers[e.pointerId]; if (!anyPointer() && !spaceDown) setHold(false); }
  pad.addEventListener('pointerup', lift);
  pad.addEventListener('pointercancel', lift);
  pad.addEventListener('lostpointercapture', lift);
  pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  pad.addEventListener('selectstart', function (e) { e.preventDefault(); });
  pad.addEventListener('dragstart', function (e) { e.preventDefault(); });
  function typing(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeTray(); return; }
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (typing(e.target) || document.querySelector('.siw-back')) return;
    e.preventDefault();
    if (e.repeat) return;
    spaceDown = true; setHold(true);
  }, true);
  window.addEventListener('keyup', function (e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (typing(e.target)) return;
    e.preventDefault();
    spaceDown = false; if (!anyPointer()) setHold(false);
  }, true);
  window.addEventListener('blur', function () { spaceDown = false; pointers = {}; setHold(false); });

  /* ── the microphone, shared by the recorder and the ear ─────────── */
  var MIC = { stream: null, ac: null, src: null, rec: false, ear: false };
  async function micUp(who) {
    if (!MIC.stream || !MIC.stream.active) {
      /* the air itself is what this instrument listens for, so nothing is filtered out of it */
      MIC.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      MIC.ac = new (window.AudioContext || window.webkitAudioContext)();
      MIC.src = MIC.ac.createMediaStreamSource(MIC.stream);
    }
    if (MIC.ac.state === 'suspended') { try { await MIC.ac.resume(); } catch (e) {} }
    MIC[who] = true;
    setupBins(MIC.ac.sampleRate);
    return MIC;
  }
  function micDown(who) {
    MIC[who] = false;
    if (MIC.rec || MIC.ear) return;
    if (MIC.stream) MIC.stream.getTracks().forEach(function (t) { t.stop(); });
    if (MIC.ac) { try { MIC.ac.close(); } catch (e) {} }
    MIC.stream = null; MIC.ac = null; MIC.src = null;
  }
  function unhook(an) { if (an && MIC.src) { try { MIC.src.disconnect(an); } catch (e) {} } }

  /* ── the recorder (SDJStage.record, adapted) ─────────────────────── */
  var N = 128, COS = new Float64Array(N), SIN = new Float64Array(N);
  for (var i0 = 0; i0 < N; i0++) { var a0 = (i0 / N) * TAU; COS[i0] = Math.cos(a0); SIN[i0] = Math.sin(a0); }
  var smoothR = null, spikeR = null, bins = null, minBin = 1, maxBin = 2, binsFor = 0;
  var rec = null, analyser = null, freqData = null, timeData = null;
  var state = 'idle', phase = 0, smoothAmp = 0;
  var elapsed = 0, t0 = 0;
  var imp = null, stopMeta = null;

  function setupBins(rate) {
    if (binsFor === rate && bins) return;
    var binHz = rate / 2048, count = 1024;
    minBin = Math.max(1, Math.round(80 / binHz));
    maxBin = Math.min(count - 1, Math.round(8000 / binHz));
    var logMin = Math.log(80), logMax = Math.log(8000);
    bins = new Int32Array(N);
    for (var i = 0; i < N; i++) {
      var f = Math.exp(logMin + (i / N) * (logMax - logMin));
      bins[i] = Math.max(minBin, Math.min(maxBin, Math.round(f / binHz)));
    }
    binsFor = rate;
  }
  function recMs() { return imp ? imp.acc + (state === 'recording' ? performance.now() - imp.since : 0) : 0; }

  async function arm() {
    if (state !== 'idle') { disarm(); return; }
    if (mode !== 'record') setMode('record');
    try { await micUp('rec'); } catch (e) { flash('The microphone opens once this page is allowed to use it.'); return; }
    analyser = MIC.ac.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    MIC.src.connect(analyser);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    smoothR = null; spikeR = null;
    var parts = [], r = new MediaRecorder(MIC.stream);
    rec = r;
    r.ondataavailable = function (e) { if (e.data && e.data.size) parts.push(e.data); };
    r.onstop = function () {
      var mime = r.mimeType || 'audio/mp4';
      var blob = new Blob(parts, { type: mime });
      parts = [];
      var meta = stopMeta; stopMeta = null;
      if (blob.size && meta) took(blob, meta);
    };
    state = 'armed';
    sync();
  }
  function dropAnalyser() { unhook(analyser); analyser = null; freqData = null; timeData = null; }
  function disarm() {
    dropAnalyser(); rec = null;
    micDown('rec');
    state = 'idle';
    sync();
  }
  function start() {
    if (state === 'armed' && rec && rec.state === 'inactive') {
      rec.start(1000);
      elapsed = 0;
      imp = { events: [[0, bstate]], acc: 0, since: performance.now(), src: {}, guide: guide.on ? [[0, pref.pace]] : [] };
      if (held) imp.src.hand = true;
      if (ear.on) imp.src.ear = true;
      liveEpoch = performance.now(); trail.length = 0;
    } else if (state === 'paused' && rec && rec.state === 'paused') {
      rec.resume();
      imp.since = performance.now();
      var last = imp.events[imp.events.length - 1];
      if (last && last[1] !== bstate) imp.events.push([Math.round(imp.acc), bstate]);
    } else return;
    state = 'recording';
    t0 = Date.now();
    sync();
  }
  function pause() {
    if (state !== 'recording') return;
    if (rec && rec.state === 'recording') rec.pause();
    elapsed += Date.now() - t0;
    imp.acc += performance.now() - imp.since;
    state = 'paused';
    sync();
  }
  function stop() {
    if (state === 'idle') return;
    if (state === 'recording') { elapsed += Date.now() - t0; imp.acc += performance.now() - imp.since; }
    if (imp && (state === 'recording' || state === 'paused')) {
      var D = Math.round(imp.acc);
      var ev = [];
      imp.events.forEach(function (e) {
        if (e[0] > D) return;
        if (ev.length && ev[ev.length - 1][0] === e[0]) ev.pop();
        if (ev.length && ev[ev.length - 1][1] === e[1]) return;
        ev.push([e[0], e[1]]);
      });
      var s = summarize(ev, D);
      var src = Object.keys(imp.src);
      stopMeta = { D: D, s: s, imprint: {
        v: 2, events: ev, in_ms: s.ins, out_ms: s.outs, model: MODEL,
        source: src.length > 1 ? 'both' : (src[0] || 'hand'),
        guide: imp.guide.filter(function (g) { return g[0] <= D; }), shape: pref.shape
      } };
      if (!stopMeta.imprint.guide.length) stopMeta.imprint.guide = null;
      imp = null;
    }
    if (rec && rec.state !== 'inactive') rec.stop();
    dropAnalyser(); rec = null;
    micDown('rec');
    state = 'idle';
    sync();
  }

  /* ── the ear: it hears the sound of air and turns each breath the other way from the last ── */
  var ear = { on: false, an: null, td: null, fd: null, bt: null, floor: null, act: 0, quiet: 0, seg: null, expect: 1, lv: 0, segs: [], warm: 0 };
  async function earToggle() {
    if (ear.on) { earOff(); return; }
    try { await micUp('ear'); } catch (e) { flash('The microphone opens once this page is allowed to use it.'); return; }
    var an = MIC.ac.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0.75;
    MIC.src.connect(an);
    ear.an = an; ear.td = new Float32Array(an.fftSize); ear.dd = new Float32Array(an.fftSize);
    ear.fd = new Uint8Array(an.frequencyBinCount); ear.bt = new Uint8Array(an.fftSize);
    ear.floor = null; ear.act = 0; ear.quiet = 0; ear.seg = null; ear.warm = 0; ear.lv = 0;
    ear.expect = bstate === 1 ? 0 : 1;
    ear.on = true;
    if (imp) imp.src.ear = true;
    earSync();
  }
  function earOff() {
    if (ear.seg) endSeg();
    unhook(ear.an); ear.an = null; ear.on = false; ear.lv = 0;
    micDown('ear');
    pad.classList.remove('heard');
    if (bstate === 2 && !held) setBreath(0, 'ear');
    earSync();
  }
  function earSync() {
    tbEar.classList.toggle('on', ear.on);
    tbEar.setAttribute('aria-pressed', ear.on ? 'true' : 'false');
    tbEar.style.setProperty('--lv', 0);
    lampSync();
  }
  /* which way a breath went, from how loud it was, once enough of each kind have been heard */
  function byLoudness(db) {
    var a = { in: [], out: [] };
    ear.segs.forEach(function (s) { a[s.kind].push(s.db); });
    if (a.in.length < 3 || a.out.length < 3) return null;
    function mean(x) { return x.reduce(function (s, v) { return s + v; }, 0) / x.length; }
    var mi = mean(a.in), mo = mean(a.out);
    if (Math.abs(mi - mo) < 5) return null;
    var mid = (mi + mo) / 2, loudIs = mo > mi ? 'out' : 'in';
    if (db > mid + 1.5) return loudIs;
    if (db < mid - 1.5) return loudIs === 'out' ? 'in' : 'out';
    return null;
  }
  function decide(sg) {
    sg.decided = true;
    if (held) { sg.kind = 'in'; ear.expect = 0; return; }
    if (sg.v / sg.n > 0.5) { sg.kind = 'voice'; setBreath(0, 'ear'); ear.expect = 1; return; }
    /* the first moment of a breath is still rising, so it turns by turn; loudness corrects it once it has sounded */
    sg.kind = ear.expect ? 'in' : 'out';
    setBreath(sg.kind === 'in' ? 1 : 0, 'ear');
    ear.expect = sg.kind === 'in' ? 0 : 1;
  }
  function recheck(sg) {
    sg.checked = true;
    if (held || sg.kind === 'voice') return;
    var k = byLoudness(sg.db / sg.n);
    if (k && k !== sg.kind) { sg.kind = k; setBreath(k === 'in' ? 1 : 0, 'ear'); ear.expect = k === 'in' ? 0 : 1; }
  }
  function endSeg() {
    var sg = ear.seg; ear.seg = null; ear.act = 0;
    if (!sg || !sg.decided) return;
    if (sg.kind === 'in' || sg.kind === 'out') { ear.segs.push({ kind: sg.kind, db: sg.db / Math.max(1, sg.n) }); if (ear.segs.length > 12) ear.segs.shift(); }
    if (!held) setBreath(2, 'ear');
  }
  function earTick(now, dt) {
    var an = ear.an; if (!an || !MIC.ac) return;
    an.getFloatTimeDomainData(ear.td);
    var td = ear.td, dd = ear.dd, n = td.length, mean = 0, e0 = 0, ed = 0, i;
    for (i = 0; i < n; i++) mean += td[i];
    mean /= n;
    for (i = 0; i < n; i++) { var v = td[i] - mean; e0 += v * v; dd[i] = i ? td[i] - td[i - 1] : 0; ed += dd[i] * dd[i]; }
    var rms = Math.sqrt(e0 / n);
    ear.warm += dt;
    /* the room's own quiet, learned as it goes: it falls quickly and rises slowly */
    if (ear.floor == null) ear.floor = Math.max(rms, 0.0008);
    if (rms < ear.floor) ear.floor += (rms - ear.floor) * Math.min(1, dt * 3);
    else ear.floor += (rms - ear.floor) * Math.min(1, dt * (ear.seg ? 0.02 : 0.08));
    var thr = Math.max(ear.floor * 2.2, 0.0022), loud = rms > thr;
    var lvT = loud ? clamp01(0.3 + (rms - thr) / (thr * 4)) : 0;
    ear.lv += (lvT - ear.lv) * Math.min(1, dt * 10);
    if (ear.warm < 0.6) return;
    /* a voice repeats itself (a pitch); air does not. Measured on the edges of the sound, so the
       rumble of breath on the microphone never passes for a voice. */
    var voiced = false;
    if (loud && ed > 0) {
      var sr = MIC.ac.sampleRate, lo = Math.floor(sr / 420), hi = Math.min(n >> 1, Math.floor(sr / 75)), best = 0, vd = ed / n;
      for (var lag = lo; lag <= hi; lag += 2) {
        var c = 0, m = n - lag;
        for (var j = 1; j < m; j += 2) c += dd[j] * dd[j + lag];
        c = c * 2 / m / vd;
        if (c > best) best = c;
      }
      voiced = best > 0.5;
    }
    if (loud) { ear.act += dt; ear.quiet = 0; } else { ear.quiet += dt; if (!ear.seg) ear.act = Math.max(0, ear.act - dt * 1.5); }
    if (!ear.seg && ear.act >= 0.12) ear.seg = { t: now, n: 0, v: 0, db: 0, decided: false, checked: false, kind: null };
    var sg = ear.seg;
    if (sg) {
      if (loud) { sg.n++; if (voiced) sg.v++; sg.db += 20 * Math.log10(rms + 1e-9); }
      if (!sg.decided && sg.n >= 6) decide(sg);
      else if (sg.decided && !sg.checked && now - sg.t > 550) recheck(sg);
      if (ear.quiet >= 0.32) endSeg();
    }
    pad.classList.toggle('heard', !!(ear.seg && ear.seg.decided && ear.seg.kind !== 'voice'));
  }

  /* ── the guide: the shape breathes on its own at the chosen pace ── */
  var guide = { on: false, t0: 0 };
  function ease(u) { return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u)); }
  function guideAt(now) {
    var ph = paceNow().ph, T = ph[0] + ph[1] + ph[2] + ph[3], t = ((now - guide.t0) / 1000) % T;
    if (t < ph[0]) return { x: ease(t / ph[0]), k: 'in', left: ph[0] - t };
    t -= ph[0]; if (t < ph[1]) return { x: 1, k: 'hold', left: ph[1] - t };
    t -= ph[1]; if (t < ph[2]) return { x: 1 - ease(t / ph[2]), k: 'out', left: ph[2] - t };
    t -= ph[2]; return { x: 0, k: 'hold', left: ph[3] - t };
  }
  function guideSet(on) {
    guide.on = on; guide.t0 = performance.now();
    padGo.classList.toggle('on', on); pad.classList.toggle('guiding', on);
    padGo.setAttribute('aria-label', on ? 'Stop the guide' : 'Start the guide');
    if (state === 'recording' && imp) imp.guide.push([Math.round(recMs()), on ? pref.pace : null]);
    if (!on) { sayLine.textContent = SAY0; lastSay = ''; }
  }
  padGo.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  padGo.addEventListener('click', function (e) { e.stopPropagation(); closeTray(); guideSet(!guide.on); padGo.blur(); });
  var lastSay = '', SAYS = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out' };
  function sayGuide(gv) {
    var s = SAYS[gv.k] + ' · ' + Math.max(1, Math.ceil(gv.left - 0.05));
    if (s !== lastSay) { sayLine.textContent = s; lastSay = s; }
    padGo.style.setProperty('--g', gv.x.toFixed(3));
  }

  /* ── the controls: the top bar, and the button at the heart ─────── */
  function lampSync() {
    lampEl.className = 'lamp' + (state === 'armed' ? ' armed' : state === 'recording' ? ' rec' : state === 'paused' ? ' paused' : ear.on ? ' ear' : '');
  }
  function coreSync() {
    var g, lab, cls = '';
    if (mode === 'listen') {
      var playing = lstate === 'playing';
      g = playing ? GLYPH.pause : GLYPH.play; lab = playing ? 'Pause' : 'Play'; cls = playing ? 'on' : 'green';
      core.disabled = !cur;
    } else {
      core.disabled = false;
      if (state === 'idle') { g = GLYPH.mic; lab = 'Arm'; }
      else if (state === 'armed') { g = GLYPH.rec; lab = 'Record'; cls = 'on red'; }
      else if (state === 'recording') { g = GLYPH.pause; lab = 'Pause'; cls = 'on'; }
      else { g = GLYPH.rec; lab = 'Record'; cls = 'red'; }
    }
    if (core._g !== g) { core.innerHTML = g; core._g = g; }
    core.className = cls; core.setAttribute('aria-label', lab);
  }
  core.addEventListener('click', function (e) {
    e.stopPropagation(); closeTray();
    if (mode === 'listen') { if (lstate === 'playing') lpause(); else lplay(); }
    else if (state === 'idle') arm();
    else if (state === 'armed' || state === 'paused') start();
    else if (state === 'recording') pause();
    core.blur();
  });
  function sync() {
    var busy = state === 'recording' || state === 'paused';
    tbArm.disabled = busy; tbArm.classList.toggle('on', state === 'armed');
    tbRec.disabled = !(state === 'armed' || state === 'paused'); tbRec.classList.toggle('on', state === 'recording');
    tbPause.disabled = state !== 'recording'; tbPause.classList.toggle('on', state === 'paused');
    tbStop.disabled = state === 'idle';
    tbTakes.disabled = busy;
    railEl.classList.toggle('dim', busy);
    doc.dataset.rec = state;
    lampSync(); coreSync();
  }
  function bind(b, fn) { b.addEventListener('click', function (e) { e.stopPropagation(); closeTray(); tapTip(b); fn(); b.blur(); }); }
  bind(tbArm, function () { arm(); });
  bind(tbRec, function () { start(); });
  bind(tbPause, function () { pause(); });
  bind(tbStop, function () { stop(); });
  bind(tbPlay, function () { lplay(); });
  bind(tbLPause, function () { lpause(); });
  bind(tbLStop, function () { lstop(); });
  bind(tbTakes, function () { setMode(mode === 'listen' ? 'record' : 'listen'); });
  bind(tbEar, function () { earToggle(); });

  /* ── listening (SDJStage.listen's play and pause, with stop) ─────── */
  var audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  var cur = null, lstate = 'stopped', heard = false, shownX = 0, forId = null;
  function lsync() {
    var playing = lstate === 'playing';
    tbPlay.classList.toggle('on', playing);
    tbLPause.classList.toggle('on', lstate === 'paused' && heard);
    tbPlay.disabled = playing || !cur;
    tbLPause.disabled = !playing;
    tbLStop.disabled = lstate === 'stopped';
    coreSync();
  }
  function srcReady(t) { return t.url || (t.signed && t.signedAt > Date.now() - 50 * 60000) ? (t.url || t.signed) : null; }
  function fetchSrc(t) {
    var ready = srcReady(t);
    if (ready) return Promise.resolve(ready);
    if (!sb || !t.audio_path) return Promise.reject(new Error('no audio'));
    return sb.storage.from(BUCKET).createSignedUrl(t.audio_path, 3600).then(function (r) {
      if (r.error) throw r.error;
      t.signed = r.data.signedUrl; t.signedAt = Date.now();
      return t.signed;
    });
  }
  function playNow() {
    var p = audio.play();
    lstate = 'playing'; heard = true; lsync();
    if (p && p.catch) p.catch(function () { lstate = 'stopped'; lsync(); flash('Tap play to listen.'); });
  }
  function lplay() {
    if (!cur || lstate === 'playing') return;
    if (forId === cur.id && audio.src) { playNow(); return; }
    var ready = srcReady(cur);
    if (ready) { audio.src = ready; forId = cur.id; playNow(); return; }
    var want = cur;
    flash('Opening the take.');
    fetchSrc(want).then(function (u) {
      if (cur !== want) return;
      audio.src = u; forId = want.id; playNow();
    }).catch(function (e) { flash('This take is resting. Try again in a moment.'); });
  }
  function lpause() {
    if (lstate !== 'playing') return;
    audio.pause(); lstate = 'paused'; lsync();
  }
  function lstop() {
    try { audio.pause(); audio.currentTime = 0; } catch (e) {}
    lstate = 'stopped'; lsync();
  }
  audio.addEventListener('ended', function () { lstate = 'stopped'; try { audio.currentTime = 0; } catch (e) {} lsync(); });
  function posMs() {
    if (!cur) return 0;
    var D = cur.duration_ms || 0;
    if (lstate === 'stopped') return 0;
    return Math.min(D, (audio.currentTime || 0) * 1000);
  }

  /* ── the two modes ──────────────────────────────────────────────── */
  var mode = 'record';
  function setMode(m) {
    if (m === mode) return;
    if (m === 'listen' && (state === 'recording' || state === 'paused')) return;
    if (m === 'listen' && state === 'armed') disarm();
    if (m === 'record') lstop();
    mode = m; doc.dataset.mode = m;
    tbTakes.classList.toggle('on', m === 'listen');
    tbTakes.setAttribute('aria-pressed', m === 'listen' ? 'true' : 'false');
    $('#tbRecSet').hidden = m !== 'record';
    $('#tbLisSet').hidden = m !== 'listen';
    if (m === 'listen' && !cur) { var first = pending[0] || takes[0]; if (first) select(first); }
    lsync(); sync(); renderRail(); fitBar();
  }
  function select(t) {
    if (cur && cur !== t) lstop();
    cur = t; ksOf(t); impCache.id = null;
    lsync();
  }

  /* ── the trays: the shape, the dial's time, the guide's pace ─────── */
  var trayFor = null;
  function shapeSync() {
    tbShape.innerHTML = SH.icon[pref.shape];
    plateEl.textContent = pref.shape;
    tbDial.querySelector('.lab').textContent = dialShort(pref.dial);
    padPace.textContent = paceNow().name;
  }
  function openTray(kind, b) {
    if (trayFor === kind) { closeTray(); return; }
    closeTray(); hideTip();
    var html = '';
    if (kind === 'shape') html = SH.list.map(function (n, i) {
      return '<button type="button" role="menuitemradio" aria-checked="' + (pref.shape === n) + '" data-shape="' + n + '" class="' + (pref.shape === n ? 'on' : '') + '" style="--i:' + i + '">' + SH.icon[n] + '<span>' + n + '</span></button>';
    }).join('');
    else if (kind === 'dial') html = DIALS.map(function (ms, i) {
      return '<button type="button" role="menuitemradio" aria-checked="' + (pref.dial === ms) + '" data-dial="' + ms + '" class="' + (pref.dial === ms ? 'on' : '') + '" style="--i:' + i + '"><span>' + dialName(ms) + '</span><small>one turn</small></button>';
    }).join('');
    else if (kind === 'pace') html = PACES.map(function (p, i) {
      return '<button type="button" role="menuitemradio" aria-checked="' + (pref.pace === p.id) + '" data-pace="' + p.id + '" class="' + (pref.pace === p.id ? 'on' : '') + '" style="--i:' + i + '"><span>' + p.name + '</span><small>' + p.word + '</small></button>';
    }).join('');
    trayEl.innerHTML = html; trayEl.hidden = false; trayFor = kind; b.classList.add('open');
    var r = b.getBoundingClientRect(), tw = trayEl.offsetWidth;
    trayEl.style.left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)) + 'px';
    trayEl.style.top = (r.bottom + 6) + 'px';
  }
  function closeTray() {
    if (!trayFor) return;
    trayEl.hidden = true; trayFor = null;
    bar.querySelectorAll('.tb.open').forEach(function (x) { x.classList.remove('open'); });
  }
  [tbShape, tbDial, tbPace].forEach(function (b) {
    b.addEventListener('click', function (e) { e.stopPropagation(); openTray(b.getAttribute('data-tray'), b); b.blur(); });
  });
  trayEl.addEventListener('click', function (e) {
    var o = e.target.closest('button'); if (!o) return;
    e.stopPropagation();
    if (o.dataset.shape) { pref.shape = o.dataset.shape; }
    else if (o.dataset.dial) { pref.dial = +o.dataset.dial; REV_MS = pref.dial; }
    else if (o.dataset.pace) { pref.pace = o.dataset.pace; if (guide.on) guideSet(true); }
    keepPref(); shapeSync(); closeTray(); fitBar();
  });
  document.addEventListener('pointerdown', function (e) {
    if (trayFor && !e.target.closest('#tray') && !e.target.closest('[data-tray]')) closeTray();
  });

  /* ── a name beneath each icon: on hover, or for a moment after a tap ── */
  var tipTimer = 0;
  function showTip(b, ms) {
    if (!b || !b.dataset.tip || trayFor) return;
    tipEl.textContent = b.dataset.tip;
    var r = b.getBoundingClientRect(), w = tipEl.offsetWidth;
    tipEl.style.left = Math.max(8 + w / 2, Math.min(innerWidth - 8 - w / 2, r.left + r.width / 2)) + 'px';
    tipEl.style.top = (r.bottom + 4) + 'px';
    tipEl.classList.add('on');
    clearTimeout(tipTimer); if (ms) tipTimer = setTimeout(hideTip, ms);
  }
  function hideTip() { clearTimeout(tipTimer); tipEl.classList.remove('on'); }
  function tapTip(b) { if (!matchMedia('(hover:hover)').matches) showTip(b, 900); }
  bar.addEventListener('pointerover', function (e) { if (e.pointerType === 'mouse') showTip(e.target.closest('.tb')); });
  bar.addEventListener('pointerout', function (e) { if (e.pointerType === 'mouse') hideTip(); });

  /* the bar sits between the corners when it fits there, and in its own row beneath them when it does not */
  var wasTwo = null;
  function fitBar() {
    if (doc.classList.contains('embed')) { doc.classList.remove('row2'); return; }
    var hr = $('#homeBtn').getBoundingClientRect(), tr = $('#topRight').getBoundingClientRect();
    var need = tbSet.scrollWidth + 20, room = tr.left - hr.right;
    var two = need > room;
    doc.classList.toggle('row2', two);
    if (!two) { bar.style.left = Math.round(hr.right + 4) + 'px'; bar.style.right = Math.round(innerWidth - tr.left + 4) + 'px'; }
    else { bar.style.left = ''; bar.style.right = ''; }
    if (two !== wasTwo) { wasTwo = two; requestAnimationFrame(function () { layout(); }); }
  }

  /* ── Supabase, the takes, saving ────────────────────────────────── */
  var sb = null, session = null, takes = [], pending = [], loading = true;
  try { if (window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); } catch (e) { sb = null; }

  function extFor(mime) { return /webm/.test(mime) ? 'webm' : /ogg/.test(mime) ? 'ogg' : /mp4|aac|m4a/.test(mime) ? 'm4a' : /wav/.test(mime) ? 'wav' : 'webm'; }
  function took(blob, meta) {
    var type = (blob.type || 'audio/webm').split(';')[0];
    var t = {
      id: uuid(), local: true, blob: blob, type: type, ext: extFor(type), url: URL.createObjectURL(blob),
      imprint: meta.imprint, duration_ms: meta.D, breaths: meta.s.breaths, avg_in_ms: meta.s.avgIn, avg_out_ms: meta.s.avgOut,
      created_at: new Date().toISOString(), status: 'saving'
    };
    pending.unshift(t);
    cur = t; ksOf(t); impCache.id = null; lsync();
    renderRail();
    railEl.scrollTo({ left: 0, behavior: 'smooth' });
    save(t);
  }
  async function currentSession() {
    if (!sb) return null;
    try { var r = await sb.auth.getSession(); return (r.data && r.data.session) || null; } catch (e) { return null; }
  }
  function askSignIn() {
    if (!sb || !window.SignInWindow) return;
    SignInWindow.open(sb, { closable: true, onSignedIn: function () { signedIn(); } });
  }
  var signing = false;
  async function signedIn() {
    if (signing) return; signing = true;
    session = await currentSession();
    signing = false;
    if (!session) return;
    await loadTakes();
    for (var i = pending.length - 1; i >= 0; i--) if (pending[i].status === 'waiting' || pending[i].status === 'error') await save(pending[i]);
  }
  async function save(t) {
    if (t.busy) return;
    t.busy = true;
    try { await saveOnce(t); } finally { t.busy = false; }
  }
  async function saveOnce(t) {
    if (!sb) { t.status = 'local'; renderRail(); return; }
    var s = await currentSession();
    if (!s) { t.status = 'waiting'; renderRail(); askSignIn(); return; }
    session = s;
    t.status = 'saving'; renderRail();
    var path = s.user.id + '/' + t.id + '.' + t.ext;
    try {
      var up = await sb.storage.from(BUCKET).upload(path, t.blob, { contentType: t.type, upsert: true });
      if (up.error) throw up.error;
      var ins = await sb.from(TABLE).insert({
        id: t.id, audio_path: path, imprint: t.imprint, duration_ms: t.duration_ms,
        breaths: t.breaths, avg_in_ms: t.avg_in_ms, avg_out_ms: t.avg_out_ms
      }).select('id,audio_path,imprint,duration_ms,breaths,avg_in_ms,avg_out_ms,created_at').single();
      if (ins.error) throw ins.error;
      var row = ins.data;
      row.url = t.url; row.ks = t.ks;
      pending = pending.filter(function (x) { return x !== t; });
      takes = takes.filter(function (x) { return x.id !== row.id; });
      takes.unshift(row);
      if (cur === t) cur = row;
      if (forId === t.id) forId = row.id;
      renderRail();
      flash('Your take is kept.');
    } catch (e) {
      t.status = 'error'; t.err = (e && e.message) || String(e);
      renderRail();
    }
  }
  async function loadTakes() {
    if (!sb || !session) { loading = false; renderRail(); return; }
    loading = true; renderRail();
    var r = await sb.from(TABLE).select('id,audio_path,imprint,duration_ms,breaths,avg_in_ms,avg_out_ms,created_at')
      .eq('owner', session.user.id).order('created_at', { ascending: false }).limit(80);
    loading = false;
    if (r.error) { renderRail(); flash('The takes are resting. Reload in a moment.'); return; }
    var keep = {}; takes.forEach(function (t) { keep[t.id] = t; });
    takes = (r.data || []).map(function (row) { var o = keep[row.id]; if (o) { row.url = o.url; row.ks = o.ks; row.signed = o.signed; row.signedAt = o.signedAt; } return row; });
    if (cur && !cur.local) { var same = takes.filter(function (t) { return t.id === cur.id; })[0]; if (same) cur = same; }
    renderRail();
    /* sign every address ahead of time so a tap plays at once (iOS plays only inside the tap) */
    var paths = takes.filter(function (t) { return !t.url && t.audio_path; }).map(function (t) { return t.audio_path; });
    if (paths.length) {
      sb.storage.from(BUCKET).createSignedUrls(paths, 3600).then(function (res) {
        (res.data || []).forEach(function (d) {
          if (!d || !d.signedUrl) return;
          takes.forEach(function (t) { if (t.audio_path === d.path) { t.signed = d.signedUrl; t.signedAt = Date.now(); } });
        });
      });
    }
  }
  async function erase(t) {
    if (cur === t) { lstop(); cur = null; lsync(); }
    try {
      if (t.audio_path) await sb.storage.from(BUCKET).remove([t.audio_path]);
      var r = await sb.from(TABLE).delete().eq('id', t.id);
      if (r.error) throw r.error;
      takes = takes.filter(function (x) { return x !== t; });
      renderRail();
    } catch (e) { flash('That take stays for now. Try again in a moment.'); }
  }

  /* ── the shelf ──────────────────────────────────────────────────── */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(iso) {
    var d = new Date(iso), now = new Date();
    var h = d.getHours(), m = d.getMinutes(), tm = ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm');
    var day = d.toDateString() === now.toDateString() ? 'Today' : MON[d.getMonth()] + ' ' + d.getDate();
    return day + ' · ' + tm;
  }
  function rosette(t, size) {
    var c = size / 2, r0 = size * 0.2, r1 = size * 0.47, D = t.duration_ms || 1, ks = ksOf(t), M = 96, d = '';
    for (var i = 0; i <= M; i++) {
      var x = xAt(ks, D * i / M), r = r0 + x * (r1 - r0), a = TOP + TAU * i / M;
      d += (i ? 'L' : 'M') + (c + r * Math.cos(a)).toFixed(2) + ' ' + (c + r * Math.sin(a)).toFixed(2);
    }
    return '<circle cx="' + c + '" cy="' + c + '" r="' + r0 + '"/><path d="' + d + '"/>';
  }
  var seen = {};
  function cardHTML(t, pend) {
    var on = cur && cur.id === t.id;
    var n = t.breaths || 0;
    var tag = '';
    if (pend) {
      if (t.status === 'saving') tag = '<span class="tag">keeping it…</span>';
      else if (t.status === 'waiting') tag = '<span class="tag"><button type="button" data-act="keep">sign in to keep it</button></span>';
      else if (t.status === 'error') tag = '<span class="tag"><button type="button" data-act="retry">keep it again</button></span>';
      else if (t.status === 'local') tag = '<span class="tag">here until you leave</span>';
    }
    var fresh = !seen[t.id]; seen[t.id] = true;
    return '<div class="take' + (on ? ' on' : '') + (pend ? ' pend' : '') + (fresh ? ' fresh' : '') + '" role="button" tabindex="0" data-take="' + esc(t.id) + '"' +
      ' aria-label="Take from ' + esc(when(t.created_at)) + ', ' + clock(t.duration_ms) + ', ' + n + ' breaths">' +
      '<svg class="ros" viewBox="0 0 44 44" aria-hidden="true">' + rosette(t, 44) + '</svg>' +
      '<div class="meta"><b>' + esc(when(t.created_at)) + '</b><span>' + clock(t.duration_ms) + ' · ' + n + (n === 1 ? ' breath' : ' breaths') + '</span>' + tag + '</div>' +
      (on && !pend ? '<button type="button" class="erase" data-act="erase" aria-label="Erase this take">×</button>' : '') +
      '</div>';
  }
  function renderRail() {
    var html = '';
    pending.forEach(function (t) { html += cardHTML(t, true); });
    if (loading) html += '<div class="take skel"><i></i><div><u style="width:80px"></u><u style="width:56px"></u></div></div><div class="take skel"><i></i><div><u style="width:70px"></u><u style="width:60px"></u></div></div>';
    else if (!session && !pending.length) html += '<div class="empty">Your takes gather here.' + (sb ? ' <button type="button" data-act="signin">Sign in</button>' : '') + '</div>';
    else if (session && !takes.length && !pending.length) html += '<div class="empty">Your takes gather here.</div>';
    takes.forEach(function (t) { html += cardHTML(t, false); });
    railEl.innerHTML = html;
  }
  function findTake(id) {
    return pending.filter(function (t) { return t.id === id; })[0] || takes.filter(function (t) { return t.id === id; })[0] || null;
  }
  var dragged = false, drag = null, sureTimer = null;
  railEl.addEventListener('click', function (e) {
    if (dragged) return;
    var act = e.target.closest('[data-act]');
    var card = e.target.closest('[data-take]');
    var t = card ? findTake(card.getAttribute('data-take')) : null;
    if (act) {
      e.stopPropagation();
      var a = act.getAttribute('data-act');
      if (a === 'signin' || a === 'keep') { askSignIn(); return; }
      if (a === 'retry' && t) { save(t); return; }
      if (a === 'erase' && t) {
        if (act.classList.contains('sure')) { clearTimeout(sureTimer); erase(t); return; }
        act.classList.add('sure'); act.textContent = 'erase';
        clearTimeout(sureTimer);
        sureTimer = setTimeout(function () { act.classList.remove('sure'); act.textContent = '×'; }, 3000);
        return;
      }
      return;
    }
    if (!t || state === 'recording' || state === 'paused') return;
    if (state === 'armed') disarm();
    var same = cur === t;
    select(t);
    if (mode !== 'listen') setMode('listen'); else renderRail();
    if (same && lstate === 'playing') { lpause(); return; }
    lplay();
  });
  railEl.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter') && e.target.matches('[data-take]')) { e.preventDefault(); e.target.click(); }
  });
  /* a mouse can drag the shelf, and the wheel turns it */
  railEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, s: railEl.scrollLeft }; dragged = false;
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (!dragged && Math.abs(dx) > 6) { dragged = true; railEl.classList.add('dragging'); }
    if (dragged) railEl.scrollLeft = drag.s - dx;
  });
  window.addEventListener('pointerup', function () {
    if (!drag) return;
    drag = null; railEl.classList.remove('dragging');
    setTimeout(function () { dragged = false; }, 0);
  });
  railEl.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && railEl.scrollWidth > railEl.clientWidth) { railEl.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });

  /* ── the readout ────────────────────────────────────────────────── */
  var flashText = '', flashUntil = 0, lastRead = '';
  function flash(s) { flashText = s; flashUntil = performance.now() + 2800; }
  function breathIndex(t, ms) {
    var ev = (t.imprint && t.imprint.events) || [], n = 0;
    for (var i = 0; i < ev.length && ev[i][0] <= ms; i++) if (ev[i][1] === 1) n++;
    return n;
  }
  function readout(now) {
    var s;
    if (now < flashUntil) s = esc(flashText);
    else if (mode === 'listen') {
      if (!cur) s = (pending.length || takes.length) ? 'Choose a take to listen.' : '';
      else {
        var n = cur.breaths || 0, bits = [];
        if (lstate !== 'stopped') bits.push('<b>breath ' + Math.min(n, breathIndex(cur, posMs())) + ' of ' + n + '</b>');
        else bits.push(n + (n === 1 ? ' breath' : ' breaths'));
        if (cur.avg_in_ms) bits.push('in ' + secs(cur.avg_in_ms));
        if (cur.avg_out_ms) bits.push('out ' + secs(cur.avg_out_ms));
        s = bits.join(' · ');
      }
    } else {
      var bits2 = [];
      if (state === 'armed') bits2.push('<b>armed</b>');
      if (state === 'recording' || state === 'paused') {
        var c = 0; (imp && imp.events || []).forEach(function (e) { if (e[1] === 1) c++; });
        bits2.push('<b>' + (state === 'recording' ? 'recording' : 'paused') + '</b>');
        bits2.push(c + (c === 1 ? ' breath' : ' breaths'));
      }
      var inS = inAt != null ? now - inAt : lastIn, outS = outAt != null ? now - outAt : lastOut;
      if (inS != null) bits2.push('in ' + secs(inS));
      if (outS != null) bits2.push('out ' + secs(outS));
      s = bits2.join(' · ');
    }
    if (s !== lastRead) { readEl.innerHTML = s; lastRead = s; }
  }

  /* ── drawing the gauge ──────────────────────────────────────────── */
  var impCache = { id: null, pts: null, M: 0 };
  function imprintPts(t) {
    if (impCache.id === t.id && impCache.S === geo.S) return impCache;
    var D = t.duration_ms || 1, M = 900, pts = new Float32Array((M + 1) * 2), ks = ksOf(t), C = geo.C;
    for (var i = 0; i <= M; i++) {
      var r = rOf(xAt(ks, D * i / M)), a = TOP + TAU * i / M;
      pts[2 * i] = C + r * Math.cos(a); pts[2 * i + 1] = C + r * Math.sin(a);
    }
    impCache = { id: t.id, S: geo.S, pts: pts, M: M };
    return impCache;
  }
  function angLive(t) { return TOP + TAU * ((((t - liveEpoch) % REV_MS) + REV_MS) % REV_MS) / REV_MS; }
  function dial() {
    var C = geo.C;
    ctx.lineWidth = 1;
    ctx.strokeStyle = K.lo;
    ctx.beginPath(); ctx.arc(C, C, geo.rMax, 0, TAU); ctx.stroke();
    ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.arc(C, C, geo.rMin, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (var i = 0; i < 60; i++) {
      var a = TOP + i * TAU / 60, major = i % 5 === 0, r1 = geo.rMax + 3, r2 = geo.rMax + (major ? 10 : 6);
      ctx.strokeStyle = major ? K.mid : K.lo;
      ctx.beginPath(); ctx.moveTo(C + r1 * Math.cos(a), C + r1 * Math.sin(a)); ctx.lineTo(C + r2 * Math.cos(a), C + r2 * Math.sin(a)); ctx.stroke();
    }
    /* the dial's time at its quarters: one turn is whatever the dial is set to */
    var listening = mode === 'listen' && cur, span = listening ? (cur.duration_ms || 0) : REV_MS;
    ctx.font = (K.studio ? '600 10px ' : '12px ') + K.font;
    ctx.fillStyle = K.mid; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var q = 0; q < 4; q++) {
      var aq = TOP + q * TAU / 4, rq = geo.rMax + (q % 2 ? 14 : 19);
      ctx.textAlign = q === 1 ? 'left' : q === 3 ? 'right' : 'center';
      ctx.fillText(clock(q ? span * q / 4 : span), C + rq * Math.cos(aq), C + rq * Math.sin(aq) + (q === 0 ? 2 : q === 2 ? -1 : 0));
    }
    ctx.textAlign = 'center';
  }
  function drawTrail(now, acc) {
    var n = trail.length; if (n < 2) return;
    var C = geo.C, B = 32;
    ctx.lineWidth = 1.25; ctx.lineJoin = 'round';
    for (var b = 0; b < B; b++) {
      var i0 = Math.floor(b * (n - 1) / B), i1 = Math.floor((b + 1) * (n - 1) / B);
      if (i1 <= i0) continue;
      var age = (now - trail[i1][0]) / REV_MS, al = (1 - age) * 0.85;
      if (al <= 0.03) continue;
      ctx.beginPath();
      for (var i = i0; i <= i1; i++) {
        var p = trail[i], a = angLive(p[0]), r = rOf(p[1]);
        var px = C + r * Math.cos(a), py = C + r * Math.sin(a);
        if (i === i0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(acc, al); ctx.stroke();
    }
  }
  function drawImprint(t, pos, acc) {
    var c = imprintPts(t), pts = c.pts, M = c.M, D = t.duration_ms || 1;
    ctx.lineWidth = 1.1; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (var i = 0; i <= M; i++) { if (i) ctx.lineTo(pts[2 * i], pts[2 * i + 1]); else ctx.moveTo(pts[0], pts[1]); }
    ctx.strokeStyle = K.mid; ctx.stroke();
    var k = Math.floor(M * clamp01(pos / D));
    if (k > 0) {
      ctx.beginPath();
      for (var j = 0; j <= k; j++) { if (j) ctx.lineTo(pts[2 * j], pts[2 * j + 1]); else ctx.moveTo(pts[0], pts[1]); }
      ctx.strokeStyle = rgba(acc, 0.9); ctx.lineWidth = 1.7; ctx.stroke();
    }
  }
  function voiceRing(R, an, fd, td) {
    an.getByteFrequencyData(fd);
    an.getByteTimeDomainData(td);
    var sum = 0;
    for (var i = 0; i < td.length; i++) { var v = (td[i] - 128) / 128; sum += v * v; }
    var rms = Math.sqrt(sum / td.length);
    smoothAmp = smoothAmp * 0.8 + rms * 0.2;
    var vol = smoothAmp, S = geo.S, C = geo.C;
    if (!smoothR || smoothR.length !== N) { smoothR = new Float32Array(N).fill(R); spikeR = new Float32Array(N).fill(0); }
    var DEFORM = S * 0.04, WOBBLE = S * 0.008, SPIKE = S * 0.03, MAXR = geo.rMax + 8;
    var finalR = new Float32Array(N);
    for (var j = 0; j < N; j++) {
      var bin = bins[j];
      var amp = fd[Math.max(minBin, bin - 2)] + fd[Math.max(minBin, bin - 1)] +
        fd[bin] + fd[Math.min(maxBin, bin + 1)] + fd[Math.min(maxBin, bin + 2)];
      amp = (amp / 5) / 255;
      var a = (j / N) * TAU;
      var wob = Math.sin(a * 3 + phase) * WOBBLE + Math.sin(a * 5 + phase * 1.4) * WOBBLE * 0.45 + Math.sin(a * 2 + phase * 0.65) * WOBBLE * 0.3;
      smoothR[j] = smoothR[j] * 0.55 + (R + vol * S * 0.02 + amp * DEFORM + wob) * 0.45;
      var raw = fd[bin] / 255;
      spikeR[j] = spikeR[j] * 0.44 + Math.pow(raw, 1.6) * SPIKE * 0.56;
      finalR[j] = Math.min(smoothR[j] + spikeR[j], MAXR);
    }
    ctx.beginPath();
    for (var k = 0; k < N; k++) {
      var nx = (k + 1) % N;
      var x1 = C + finalR[k] * COS[k], y1 = C + finalR[k] * SIN[k];
      var x2 = C + finalR[nx] * COS[nx], y2 = C + finalR[nx] * SIN[nx];
      if (k === 0) { var l = N - 1; ctx.moveTo((C + finalR[l] * COS[l] + x1) / 2, (C + finalR[l] * SIN[l] + y1) / 2); }
      ctx.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2);
    }
    ctx.closePath();
    phase += 0.014;
    return vol;
  }
  function draw(now, gv) {
    var S = geo.S, C = geo.C, d = geo.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, geo.W || S, S);
    ctx.setTransform(d, 0, 0, d, d * (geo.ox || 0), 0);
    var recording = state === 'recording';
    var acc = recording ? REC_RED : K.amber;
    var listening = mode === 'listen' && cur;
    var x = listening ? shownX : live.x;
    var R = rOf(x);
    dial();
    /* the air in the circle */
    var g = ctx.createRadialGradient(C, C, geo.rMin * 0.6, C, C, Math.max(R, geo.rMin * 0.6 + 1));
    g.addColorStop(0, rgba(acc, 0));
    g.addColorStop(1, rgba(acc, (K.dark ? 0.05 : 0.035) + x * (K.dark ? 0.16 : 0.11)));
    ctx.beginPath(); ctx.arc(C, C, R, 0, TAU); ctx.fillStyle = g; ctx.fill();
    /* what the pen has written */
    var ang;
    if (listening) { var pos = posMs(); drawImprint(cur, pos, acc); ang = TOP + TAU * clamp01(pos / (cur.duration_ms || 1)); }
    else { drawTrail(now, acc); ang = angLive(now); }
    /* the guide, breathing on its own as a ring of dashes to follow */
    if (gv) {
      ctx.setLineDash([5, 6]); ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(K.amber, 0.75);
      ctx.beginPath(); ctx.arc(C, C, rOf(gv.x), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    /* the breath circle, rippling with the sound while the microphone is open */
    var vol = 0;
    if (!listening && analyser && freqData) vol = voiceRing(R, analyser, freqData, timeData);
    else if (!listening && ear.an) vol = voiceRing(R, ear.an, ear.fd, ear.bt);
    else { ctx.beginPath(); ctx.arc(C, C, R, 0, TAU); }
    ctx.strokeStyle = rgba(acc, 0.55 + x * 0.35 + vol * 0.3);
    ctx.lineWidth = 1.8 + x * 0.8 + vol * 2.5;
    if (K.dark) { ctx.shadowBlur = 8 + x * 10 + vol * 16; ctx.shadowColor = rgba(acc, 0.5); }
    ctx.stroke(); ctx.shadowBlur = 0;
    /* breathing along: your own breath as a dashed ring while a take plays */
    if (listening && (held || live.x > 0.004)) {
      ctx.setLineDash([3, 5]); ctx.lineWidth = 1.2; ctx.strokeStyle = K.ink;
      ctx.beginPath(); ctx.arc(C, C, rOf(live.x), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    /* the pen arm and the pen */
    var ca = Math.cos(ang), sa = Math.sin(ang);
    ctx.lineWidth = 1; ctx.strokeStyle = K.mid;
    ctx.beginPath(); ctx.moveTo(C + (geo.rMin - 4) * ca, C + (geo.rMin - 4) * sa); ctx.lineTo(C + R * ca, C + R * sa); ctx.stroke();
    ctx.beginPath(); ctx.arc(C + R * ca, C + R * sa, 3.6, 0, TAU); ctx.fillStyle = acc;
    if (K.dark) { ctx.shadowBlur = 10; ctx.shadowColor = rgba(acc, 0.8); }
    ctx.fill(); ctx.shadowBlur = 0;
  }

  /* ── drawing the shape ──────────────────────────────────────────── */
  var lastShapeX = 0, shapeVel = 0;
  function drawShape(now, dt, gv) {
    var x = gv ? gv.x : (mode === 'listen' && cur && lstate !== 'stopped') ? shownX : live.x;
    var v = dt > 0 ? (x - lastShapeX) / dt : 0;
    lastShapeX = x; shapeVel += (v - shapeVel) * Math.min(1, dt * 6);
    var W = bgeo.W, H = bgeo.H, d = bgeo.dpr;
    bctx.setTransform(d, 0, 0, d, 0, 0);
    bctx.clearRect(0, 0, W, H);
    var top = bgeo.top, bottom = Math.max(top + 40, bgeo.bottom);
    var box = { x: 20, y: top, w: Math.max(60, W - 40), h: bottom - top };
    box.cx = box.x + box.w / 2; box.cy = box.y + box.h / 2;
    var on = held || pad.classList.contains('heard') || !!gv || (mode === 'listen' && lstate === 'playing');
    SH.draw(pref.shape, bctx, box, x, now / 1000,
      { line: K.ink, mid: K.mid, lo: K.lo, acc: state === 'recording' ? REC_RED : K.amber, plate: K.plate, on: on }, shapeVel);
  }

  /* ── the loop ───────────────────────────────────────────────────── */
  var lastT = performance.now(), lastClock = '', lastLv = -1;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (ear.on) earTick(now, dt);
    var r = settle(live.x, live.v, live.target, live.w, dt);
    live.x = clamp01(r[0]); live.v = r[1];
    var every = Math.max(40, REV_MS / 1500);
    if (now - lastPush >= every) {
      trail.push([now, live.x]); lastPush = now;
      while (trail.length && now - trail[0][0] > REV_MS) trail.shift();
    }
    if (mode === 'listen' && cur) {
      var tx = lstate === 'stopped' ? 0 : xAt(ksOf(cur), posMs());
      if (lstate === 'playing') shownX = tx;
      else shownX += (tx - shownX) * (1 - Math.exp(-dt / 0.09));
    } else shownX = live.x;
    if (state === 'recording' && imp && recMs() >= LIMIT_MS) stop();
    var gv = guide.on ? guideAt(now) : null;
    if (gv) sayGuide(gv);
    draw(now, gv);
    drawShape(now, dt, gv);
    if (ear.on && Math.abs(ear.lv - lastLv) > 0.02) { tbEar.style.setProperty('--lv', ear.lv.toFixed(2)); lastLv = ear.lv; }
    var c;
    if (mode === 'listen' && cur) c = clock(posMs()) + ' / ' + clock(cur.duration_ms || 0);
    else if (state === 'recording' || state === 'paused') c = clock(elapsed + (state === 'recording' ? Date.now() - t0 : 0)) + ' / 15:00';
    else c = '0:00';
    if (c !== lastClock) { clockEl.textContent = c; lastClock = c; }
    readout(now);
  }

  window.addEventListener('beforeunload', function (e) {
    if (pending.length || state === 'recording' || state === 'paused') { e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('resize', function () { closeTray(); fitBar(); layout(); });
  if (window.ResizeObserver) new ResizeObserver(function () { layout(); }).observe(stage);
  /* a new skin brings new ink, and the corners change their width */
  new MutationObserver(function () { readInk(); impCache.id = null; fitBar(); }).observe(doc, { attributes: true, attributeFilter: ['data-skin'] });

  shapeSync();
  fitBar();
  layout();
  sync(); lsync(); renderRail();
  requestAnimationFrame(frame);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitBar(); layout(); });

  if (sb) {
    currentSession().then(function (s) { session = s; return loadTakes(); });
    sb.auth.onAuthStateChange(function (ev, s) {
      if (ev === 'SIGNED_IN' && (!session || (s && session.user.id !== s.user.id))) setTimeout(signedIn, 0);
      if (ev === 'SIGNED_OUT') { session = null; takes = []; if (cur && !cur.local) { lstop(); cur = null; } setTimeout(function () { loading = false; renderRail(); lsync(); }, 0); }
    });
  } else { loading = false; renderRail(); }

  /* for the checks that drive this page */
  window.__breath = {
    state: function () { return { mode: mode, rec: state, listen: lstate, held: held, b: bstate, x: live.x, shown: shownX, takes: takes.length, pending: pending.map(function (t) { return t.status; }), cur: cur && cur.id, geo: geo, shape: pref.shape, dial: REV_MS, pace: pref.pace, guide: guide.on, ear: ear.on, lv: ear.lv, floor: ear.floor, segs: ear.segs.slice() }; },
    imprint: function () { return imp ? JSON.parse(JSON.stringify(imp.events)) : null; },
    take: function () { return cur ? { id: cur.id, imprint: cur.imprint, duration_ms: cur.duration_ms, breaths: cur.breaths, avg_in_ms: cur.avg_in_ms, avg_out_ms: cur.avg_out_ms } : null; },
    xAt: function (ms) { return cur ? xAt(ksOf(cur), ms) : null; },
    breath: function (s) { setBreath(s, 'ear'); }
  };
})();
