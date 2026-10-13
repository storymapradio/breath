/* Breath: the shapes in the lower window. Each one is drawn in hairlines in the skin's own ink and takes
 * the whole window: x runs from 0 (empty) to 1 (full), t is seconds for anything that drifts on its own,
 * and vel is how fast x is moving (above zero filling, below zero emptying).
 *
 *   BREATH_SHAPES.list            the names, in the order of the tray
 *   BREATH_SHAPES.icon[name]      a 24 by 24 stroke icon for the top bar and the tray
 *   BREATH_SHAPES.draw(name, ctx, box, x, t, ink, vel)
 *
 * box = { x, y, w, h, cx, cy }, the room the shape may use. ink = { line, mid, lo, acc, plate, on }:
 * the outline is drawn in acc while the breath is being held, heard or guided, and in line otherwise.
 */
(function () {
  'use strict';
  var TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rr(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function stroke(c, col, w, alpha) { c.strokeStyle = col; c.lineWidth = w; if (alpha != null) c.globalAlpha = alpha; c.stroke(); c.globalAlpha = 1; }
  function main(I) { return I.on ? I.acc : I.line; }
  /* a steady scatter, the same every frame */
  function rand(i) { var s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  /* ── the bellows: two boards and a leather body, the nozzle to the right ── */
  function bellows(c, B, x, t, I, vel) {
    var bw = Math.min(B.w * 0.72, 470), cx = B.cx - Math.min(16, B.w * 0.03), L = cx - bw / 2, R = cx + bw / 2;
    var board = clamp(B.h * 0.055, 7, 13), n = 7;
    var openH = B.h - board * 2 - 18, closedH = Math.max(10, openH * 0.08);
    var h = closedH + clamp(x, 0, 1) * (openH - closedH);
    var baseY = B.y + B.h - board - 6, topY = baseY - h - board;
    var s = h / (2 * n), seg = openH / (2 * n) * 1.03, dIn = Math.min(bw * 0.07, Math.sqrt(Math.max(0, seg * seg - s * s)));
    var m = main(I);
    /* the leather, filled so the room behind it is hidden */
    c.beginPath();
    for (var k = 0; k <= 2 * n; k++) { var yk = topY + board + k * s; c[k ? 'lineTo' : 'moveTo'](L + 8 + (k % 2 ? dIn : 0), yk); }
    for (k = 2 * n; k >= 0; k--) { yk = topY + board + k * s; c.lineTo(R - 8 - (k % 2 ? dIn : 0), yk); }
    c.closePath(); c.fillStyle = I.plate; c.fill();
    /* the folds across, and the creases that run into each one */
    for (k = 1; k < 2 * n; k++) {
      var y = topY + board + k * s, inset = k % 2 ? dIn : 0;
      c.beginPath(); c.moveTo(L + 8 + inset, y); c.lineTo(R - 8 - inset, y); stroke(c, k % 2 ? I.lo : I.mid, 1);
      if (!(k % 2) && s > 3) {
        for (var q = 1; q < 6; q++) {
          var qx = L + 8 + (bw - 16) * q / 6;
          c.beginPath(); c.moveTo(qx, y - s * 0.6); c.lineTo(qx + 3, y); c.lineTo(qx, y + s * 0.6); stroke(c, I.lo, 0.8, 0.7);
        }
      }
    }
    /* the two sides, pleated, with a rivet at every outer fold */
    [[L + 8, 1], [R - 8, -1]].forEach(function (side) {
      c.beginPath();
      for (var k2 = 0; k2 <= 2 * n; k2++) { var y2 = topY + board + k2 * s; c[k2 ? 'lineTo' : 'moveTo'](side[0] + side[1] * (k2 % 2 ? dIn : 0), y2); }
      stroke(c, m, 1.3);
      for (k2 = 2; k2 < 2 * n; k2 += 2) { c.beginPath(); c.arc(side[0] - side[1] * 1.5, topY + board + k2 * s, 1.3, 0, TAU); stroke(c, I.mid, 1); }
    });
    /* the boards, with their grain */
    function boardAt(by, up) {
      c.beginPath(); rr(c, L, by, bw, board, 3); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.3);
      for (var g = 0; g < 2; g++) {
        var gy = by + board * (0.36 + g * 0.3);
        c.beginPath(); c.moveTo(L + 10, gy);
        for (var gx = L + 10; gx <= R - 10; gx += 12) c.lineTo(gx, gy + Math.sin(gx * 0.05 + g * 2 + (up ? 1 : 0)) * 0.7);
        stroke(c, I.lo, 0.8);
      }
      for (var nb = 0; nb < 2; nb++) { c.beginPath(); c.arc(L + 14 + nb * (bw - 28), by + board / 2, 1.6, 0, TAU); stroke(c, I.mid, 1); }
    }
    boardAt(baseY, false);
    boardAt(topY, true);
    /* the handle on the top board, and two feet under the bottom one */
    c.beginPath(); c.moveTo(cx - 26, topY); c.lineTo(cx - 20, topY - 9); c.quadraticCurveTo(cx, topY - 12, cx + 20, topY - 9); c.lineTo(cx + 26, topY); stroke(c, m, 1.3);
    [L + 22, R - 34].forEach(function (fx) { c.beginPath(); c.moveTo(fx, baseY + board); c.lineTo(fx + 2, baseY + board + 4); c.lineTo(fx + 10, baseY + board + 4); c.lineTo(fx + 12, baseY + board); stroke(c, I.mid, 1); });
    /* the nozzle, brass ringed */
    var ny = baseY + board / 2, nl = Math.min(34, B.x + B.w - R - 6);
    c.beginPath(); c.moveTo(R, ny - board * 0.42); c.lineTo(R + nl, ny - 2); c.lineTo(R + nl, ny + 2); c.lineTo(R, ny + board * 0.42); stroke(c, m, 1.2);
    c.beginPath(); c.moveTo(R + 7, ny - board * 0.34); c.lineTo(R + 7, ny + board * 0.34); c.moveTo(R + 11, ny - board * 0.29); c.lineTo(R + 11, ny + board * 0.29); stroke(c, I.mid, 1);
    /* the air, going in or coming out of the nozzle */
    var a = clamp(Math.abs(vel || 0) * 6, 0, 1);
    if (a > 0.04) {
      for (var i = 0; i < 4; i++) {
        var ph = (t * 1.1 + i / 4) % 1, d = (vel < 0 ? ph : 1 - ph) * 30, yy = ny + (i - 1.5) * 3.2;
        c.beginPath(); c.moveTo(R + nl + 4 + d, yy); c.lineTo(R + nl + 10 + d, yy); stroke(c, I.on ? I.acc : I.mid, 1, a * (1 - Math.abs(ph - 0.5) * 1.6));
      }
    }
  }

  /* ── the lungs: the windpipe, the branching tree, two lobes on a diaphragm that flattens as you fill ── */
  function lungs(c, B, x, t, I) {
    var H = B.h, s = 0.64 + 0.36 * x, W = Math.min(B.w * 0.86, H * 1.34), cx = B.cx, m = main(I);
    var top = B.y + 2, car = top + H * 0.27, floor = B.y + H - 4, dome = (1 - x) * H * 0.11;
    var tw = Math.max(7, W * 0.04), half = W / 2 - tw;
    var apexY = car - H * 0.2 * (0.8 + 0.2 * s), baseY = floor - dome - 4, Hl = baseY - apexY;
    var lobes = [];
    [-1, 1].forEach(function (d) {
      var ax = cx + d * (tw * 0.8 + 3), w = half * s;
      var notch = d > 0 ? 0.34 : 0.04;
      c.beginPath();
      c.moveTo(ax + d * 0.3 * w, apexY);
      c.bezierCurveTo(ax + d * 0.78 * w, apexY + 0.02 * Hl, ax + d * 1.06 * w, apexY + 0.55 * Hl, ax + d * 0.98 * w, baseY - 0.05 * Hl);
      c.bezierCurveTo(ax + d * 0.82 * w, baseY + 0.03 * Hl, ax + d * 0.42 * w, baseY - 0.14 * Hl, ax + d * 0.12 * w, baseY - 0.03 * Hl);
      c.bezierCurveTo(ax + d * notch * w, baseY - 0.3 * Hl, ax + d * 0.02 * w, apexY + 0.34 * Hl, ax + d * 0.3 * w, apexY);
      c.closePath();
      c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.3);
      lobes.push({ d: d, ax: ax, w: w });
      /* the fissures */
      c.beginPath(); c.moveTo(ax + d * 0.97 * w, apexY + 0.42 * Hl); c.quadraticCurveTo(ax + d * 0.62 * w, apexY + 0.62 * Hl, ax + d * 0.36 * w, baseY - 0.08 * Hl); stroke(c, I.lo, 1);
      if (d < 0) { c.beginPath(); c.moveTo(ax + d * 0.99 * w, apexY + 0.5 * Hl); c.quadraticCurveTo(ax + d * 0.7 * w, apexY + 0.48 * Hl, ax + d * 0.5 * w, apexY + 0.55 * Hl); stroke(c, I.lo, 1); }
    });
    /* the windpipe and its rings */
    c.beginPath(); c.moveTo(cx - tw / 2, top); c.lineTo(cx - tw / 2, car - 4); c.moveTo(cx + tw / 2, top); c.lineTo(cx + tw / 2, car - 4); stroke(c, m, 1.3);
    for (var ry = top + 5; ry < car - 8; ry += 6.5) { c.beginPath(); c.moveTo(cx - tw / 2 + 1, ry); c.quadraticCurveTo(cx, ry + 2.2, cx + tw / 2 - 1, ry); stroke(c, I.lo, 1); }
    /* the tree: each side splits three ways at its hilum, then again, and again */
    var tips = [];
    function branch(x0, y0, ang, len, depth, d) {
      var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); stroke(c, depth > 1 ? I.mid : I.lo, 0.6 + depth * 0.32);
      if (!depth) { tips.push([x1, y1]); return; }
      var spread = 0.42 + 0.08 * depth;
      branch(x1, y1, ang - spread, len * 0.7, depth - 1, d);
      branch(x1, y1, ang + spread, len * 0.7, depth - 1, d);
    }
    lobes.forEach(function (lb) {
      var d = lb.d, hx = lb.ax + d * 0.16 * lb.w, hy = car + H * 0.07;
      c.beginPath(); c.moveTo(cx + d * tw / 2, car - 4); c.quadraticCurveTo(cx + d * tw * 0.8, car + 2, hx, hy); stroke(c, m, 1.2);
      /* the tree stays inside its lobe: upward toward the apex, outward to the side, down toward the base */
      var L0 = Math.min(lb.w * 0.21, Hl * 0.13);
      [[-1.2, 0.95], [-0.15, 1.1], [0.95, 1.25]].forEach(function (a0) {
        var ang = d > 0 ? a0[0] : Math.PI - a0[0];
        branch(hx, hy, ang, L0 * a0[1], 3, d);
      });
    });
    /* the air sacs at the tips, which swell as you fill */
    var ar = 0.9 + 1.9 * x;
    tips.forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], ar, 0, TAU); stroke(c, I.on ? I.acc : I.mid, 0.9, 0.55 + 0.45 * x); });
    /* the diaphragm, domed when empty and flat when full */
    var Lx = cx - W / 2 - 4, Rx = cx + W / 2 + 4;
    c.beginPath(); c.moveTo(Lx, floor);
    c.bezierCurveTo(Lx + W * 0.12, floor - dome * 2.1, cx - W * 0.16, floor - dome * 2.1, cx, floor - dome * 0.9);
    c.bezierCurveTo(cx + W * 0.16, floor - dome * 2.1, Rx - W * 0.12, floor - dome * 2.1, Rx, floor);
    stroke(c, I.mid, 1.3);
    c.beginPath(); c.moveTo(Lx + 6, floor + 3); c.lineTo(Rx - 6, floor + 3); stroke(c, I.lo, 1);
  }

  /* ── the balloon: it swells from a wrinkled scrap on its string ── */
  function balloon(c, B, x, t, I) {
    var kY = B.y + B.h * 0.82, m = main(I);
    var Rmax = Math.min((kY - B.y - 4) / 2.2, B.w * 0.3), r = Rmax * (0.18 + 0.82 * Math.pow(clamp(x, 0, 1), 0.85));
    var sway = Math.sin(t * 0.8) * (1.5 + 3 * x), kx = B.cx + sway * 0.25, cxb = B.cx + sway, cy = kY - r * 1.12;
    function body() {
      c.beginPath(); c.moveTo(kx, kY - 1);
      c.bezierCurveTo(kx - r * 0.25, kY - r * 0.25, cxb - r * 0.98, cy + r * 0.75, cxb - r * 0.96, cy);
      c.bezierCurveTo(cxb - r * 0.94, cy - r * 0.62, cxb - r * 0.52, cy - r * 1.08, cxb, cy - r * 1.08);
      c.bezierCurveTo(cxb + r * 0.52, cy - r * 1.08, cxb + r * 0.94, cy - r * 0.62, cxb + r * 0.96, cy);
      c.bezierCurveTo(cxb + r * 0.98, cy + r * 0.75, kx + r * 0.25, kY - r * 0.25, kx, kY - 1);
    }
    body(); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.4);
    /* the seams */
    [-0.42, 0.42].forEach(function (k) {
      c.beginPath(); c.moveTo(cxb, cy - r * 1.07); c.bezierCurveTo(cxb + k * r * 1.3, cy - r * 0.6, cxb + k * r * 1.1, cy + r * 0.6, kx, kY - 2); stroke(c, I.lo, 1);
    });
    /* the light on it */
    c.beginPath(); c.arc(cxb - r * 0.38, cy - r * 0.4, r * 0.34, Math.PI * 1.08, Math.PI * 1.5); stroke(c, I.on ? I.acc : I.mid, 1.8, 0.5 + 0.5 * x);
    /* wrinkles while it is nearly empty */
    var wr = clamp(1 - x / 0.35, 0, 1);
    if (wr > 0.02) {
      for (var i = 0; i < 4; i++) {
        var a = -Math.PI / 2 + (i - 1.5) * 0.5, px = cxb + Math.cos(a) * r * 0.5, py = cy + Math.sin(a) * r * 0.45;
        c.beginPath(); c.moveTo(px - 3, py); c.quadraticCurveTo(px, py - 3, px + 3, py + 1); stroke(c, I.mid, 1, wr);
      }
    }
    /* the knot, the string, and the stone it is tied to */
    c.beginPath(); c.moveTo(kx - 4.5, kY + 5); c.lineTo(kx + 4.5, kY + 5); c.lineTo(kx, kY - 1); c.closePath(); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.2);
    var gy = B.y + B.h - 8, sx = B.cx;
    c.beginPath(); c.moveTo(kx, kY + 5);
    c.bezierCurveTo(kx + Math.sin(t * 1.1) * 10, kY + (gy - kY) * 0.35, sx - Math.sin(t * 0.9 + 1) * 8, kY + (gy - kY) * 0.7, sx, gy - 4);
    stroke(c, I.mid, 1);
    c.beginPath(); c.ellipse(sx, gy, 13, 6, 0, 0, TAU); c.fillStyle = I.plate; c.fill(); stroke(c, I.mid, 1.1);
    c.beginPath(); c.moveTo(sx - 7, gy - 1); c.quadraticCurveTo(sx, gy - 4, sx + 6, gy - 2); stroke(c, I.lo, 1);
  }

  /* ── the accordion: two ends and the bellows between, opening across the window ── */
  function accordion(c, B, x, t, I) {
    var maxW = Math.min(B.w * 0.92, 620), H = Math.min(B.h * 0.78, maxW * 0.44), m = main(I);
    var eb = Math.max(28, H * 0.44), minBody = H * 0.14, maxBody = maxW - 2 * eb;
    var body = minBody + clamp(x, 0, 1) * (maxBody - minBody), total = body + 2 * eb;
    var L = B.cx - total / 2, Rr = B.cx + total / 2, yT = B.cy - H / 2, yB = yT + H;
    var xa = L + eb, xb = Rr - eb, n = 14, step = body / n, seg = maxBody / n * 1.02, zz = Math.min(H * 0.07, Math.sqrt(Math.max(0, seg * seg - step * step)) * 0.5);
    /* the bellows */
    c.beginPath(); c.moveTo(xa, yT + 4);
    for (var k = 1; k <= n; k++) c.lineTo(xa + k * step, yT + 4 + (k % 2 ? zz : 0));
    c.lineTo(xb, yB - 4);
    for (k = n - 1; k >= 0; k--) c.lineTo(xa + k * step, yB - 4 - (k % 2 ? zz : 0));
    c.closePath(); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.3);
    for (k = 1; k < n; k++) {
      var fx = xa + k * step, d = k % 2 ? zz : 0;
      c.beginPath(); c.moveTo(fx, yT + 4 + d); c.lineTo(fx, yB - 4 - d); stroke(c, k % 2 ? I.lo : I.mid, 1);
      if (!(k % 2)) {
        [yT + 4, yB - 4].forEach(function (cy, j) { c.beginPath(); c.moveTo(fx - 3, cy + (j ? -5 : 5)); c.lineTo(fx, cy); c.lineTo(fx + 3, cy + (j ? -5 : 5)); stroke(c, I.mid, 1); });
      }
    }
    /* the two ends */
    [L, xb].forEach(function (ex) { c.beginPath(); rr(c, ex, yT, eb, H, 6); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.4); });
    /* the left end: the bass buttons, and the strap */
    var cols = 3, rows = 7, bxs = L + eb * 0.22, bys = yT + H * 0.14, bwid = eb * 0.5, bhei = H * 0.72;
    for (var cI = 0; cI < cols; cI++) for (var rI = 0; rI < rows; rI++) {
      var bx = bxs + (cI + 0.5) * bwid / cols, by = bys + (rI + 0.5 + (cI % 2) * 0.5) * bhei / (rows + 0.5);
      c.beginPath(); c.arc(bx, by, Math.min(bwid / cols, bhei / rows) * 0.3, 0, TAU); stroke(c, I.mid, 1);
    }
    c.beginPath(); c.moveTo(L + eb * 0.82, yT + 6); c.lineTo(L + eb * 0.82, yB - 6); c.moveTo(L + eb * 0.92, yT + 6); c.lineTo(L + eb * 0.92, yB - 6); stroke(c, I.lo, 1);
    c.beginPath(); rr(c, L + eb * 0.78, B.cy - 5, eb * 0.18, 10, 2); stroke(c, I.mid, 1);
    /* the right end: the keys on the inner edge, the grille beside them */
    var kx0 = xb + 4, kw = eb * 0.38, ky0 = yT + 7, kh = H - 14, nk = 15;
    c.beginPath(); rr(c, kx0, ky0, kw, kh, 2); stroke(c, I.mid, 1);
    for (k = 1; k < nk; k++) { var ky = ky0 + k * kh / nk; c.beginPath(); c.moveTo(kx0, ky); c.lineTo(kx0 + kw, ky); stroke(c, I.lo, 1); }
    for (k = 0; k < nk - 1; k++) {
      if ([0, 1, 3, 4, 5].indexOf(k % 7) < 0) continue;
      var bk = ky0 + (k + 1) * kh / nk;
      c.beginPath(); c.moveTo(kx0 + kw * 0.42, bk); c.lineTo(kx0 + kw, bk); stroke(c, I.mid, 2.6);
    }
    var gx0 = kx0 + kw + 5, gw = Rr - 5 - gx0;
    if (gw > 8) {
      c.beginPath(); rr(c, gx0, ky0 + 4, gw, kh - 8, 3); stroke(c, I.lo, 1);
      for (var gy = ky0 + 10; gy < ky0 + kh - 8; gy += 7) for (var gx = gx0 + 4 + ((gy / 7) % 2) * 3; gx < gx0 + gw - 3; gx += 6) { c.beginPath(); c.arc(gx, gy, 0.9, 0, TAU); stroke(c, I.lo, 1); }
    }
  }

  /* ── the tide: water comes in up the shore as you fill, and draws back as you empty ── */
  function tide(c, B, x, t, I) {
    var W = B.w, H = B.h, x0 = B.x, y0 = B.y, m = main(I);
    var sx0 = x0 + W * 0.38;
    function shoreY(px) { var u = clamp((px - sx0) / (x0 + W - sx0), 0, 1); return y0 + H - H * 0.74 * Math.pow(u, 1.12); }
    var lv = y0 + H * (0.94 - 0.62 * clamp(x, 0, 1)), A = 2 + 3.5 * x;
    function surf(px, ph) { return lv + ph * 7 + A * Math.sin(px * 0.022 - t * 0.9 + ph * 1.7) + A * 0.55 * Math.sin(px * 0.051 + t * 0.6 + ph); }
    /* the moon and its stars */
    var mx = x0 + W * 0.18, my = y0 + 18 + (1 - x) * H * 0.18, mr = Math.min(14, H * 0.07);
    c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.2);
    c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.85, Math.PI * 0.62, Math.PI * 1.38); stroke(c, I.lo, 1);
    for (var st = 0; st < 7; st++) {
      var px = x0 + W * (0.06 + 0.88 * rand(st)), py = y0 + 6 + H * 0.3 * rand(st + 9);
      if (Math.hypot(px - mx, py - my) < mr * 2.2 || py > shoreY(px) - 10) continue;
      c.beginPath(); c.moveTo(px - 2.5, py); c.lineTo(px + 2.5, py); c.moveTo(px, py - 2.5); c.lineTo(px, py + 2.5); stroke(c, I.lo, 1);
    }
    /* the shore and its sand */
    c.beginPath(); c.moveTo(sx0, y0 + H);
    for (var sx = sx0; sx <= x0 + W; sx += 6) c.lineTo(sx, shoreY(sx));
    stroke(c, I.mid, 1.3);
    for (var g = 0; g < 70; g++) {
      var gx = sx0 + (x0 + W - sx0) * rand(g + 40), gy = shoreY(gx) + 4 + (y0 + H - shoreY(gx)) * rand(g + 90);
      if (gy > y0 + H - 2) continue;
      c.beginPath(); c.arc(gx, gy, 0.7, 0, TAU); stroke(c, I.lo, 1);
    }
    /* the water: its surface, and the swells beneath it */
    var reach = x0;
    for (var ph = 0; ph < 5; ph++) {
      c.beginPath(); var open = false;
      for (var wx = x0 + 2; wx <= x0 + W; wx += 3) {
        var wy = surf(wx, ph);
        if (wy >= shoreY(wx) - 0.5 || wy > y0 + H - 1) { if (!ph) reach = Math.max(reach, wx); break; }
        if (!ph) reach = wx;
        if (open) c.lineTo(wx, wy); else { c.moveTo(wx, wy); open = true; }
      }
      if (open) stroke(c, ph ? I.lo : m, ph ? 1 : 1.4, ph ? 1 - ph * 0.15 : 1);
    }
    /* the foam where the water meets the sand */
    for (var f = 0; f < 6; f++) {
      var fp = (t * 0.35 + f / 6) % 1, fxp = reach - 4 - fp * 26, fyp = Math.min(surf(fxp, 0), shoreY(fxp)) - 2 - Math.sin(fp * Math.PI) * 3;
      c.beginPath(); c.arc(fxp, fyp, 1.2 + rand(f) * 1.2, 0, TAU); stroke(c, I.mid, 1, 1 - fp);
    }
    /* the moon's road on the water */
    for (var rI = 0; rI < 5; rI++) {
      var ry = surf(mx, 0) + 5 + rI * 6, rw = 12 - rI * 1.8 + Math.sin(t * 1.3 + rI) * 2;
      if (ry > y0 + H - 2) break;
      c.beginPath(); c.moveTo(mx - rw / 2, ry); c.lineTo(mx + rw / 2, ry); stroke(c, I.on ? I.acc : I.mid, 1, 0.8 - rI * 0.12);
    }
  }

  /* ── the jellyfish: the bell opens as you fill and closes to push as you empty ── */
  function jellyfish(c, B, x, t, I) {
    var H = B.h, m = main(I), W0 = Math.min(B.w * 0.44, H * 0.98);
    var bw = W0 * (0.7 + 0.3 * x), bh = H * (0.33 - 0.07 * x), bob = Math.sin(t * 0.6) * 3;
    var cx = B.cx, rimY = B.y + 6 + bh + bob + (1 - x) * H * 0.04;
    var tl = B.y + H - 4 - rimY;
    /* the tentacles first, so the bell sits over them */
    var nt = 14;
    for (var i = 0; i < nt; i++) {
      var u = (i + 0.5) / nt, sx = cx - bw / 2 + bw * u * 0.96 + bw * 0.02, len = tl * (0.7 + 0.3 * rand(i));
      c.beginPath(); c.moveTo(sx, rimY);
      for (var k = 1; k <= 18; k++) {
        var f = k / 18, yy = rimY + f * len, xx = sx + Math.sin(t * 1.4 + i * 0.9 + f * 5) * (2 + f * 9) * (0.6 + 0.4 * (1 - x));
        c.lineTo(xx, yy);
      }
      stroke(c, I.lo, 0.9);
    }
    /* the oral arms, frilled */
    for (var a = 0; a < 4; a++) {
      var ax = cx + (a - 1.5) * bw * 0.07, alen = tl * 0.62;
      c.beginPath(); c.moveTo(ax, rimY - 2);
      var pts = [];
      for (k = 1; k <= 24; k++) {
        var fa = k / 24, ay = rimY - 2 + fa * alen, axx = ax + Math.sin(t * 0.9 + a * 1.3 + fa * 4) * (3 + fa * 6);
        c.lineTo(axx, ay); pts.push([axx, ay]);
      }
      stroke(c, I.mid, 1.2);
      for (k = 1; k < pts.length; k += 2) { var p = pts[k], fr = 3 + 2 * Math.sin(k + t); c.beginPath(); c.moveTo(p[0] - fr, p[1] - 1); c.lineTo(p[0] + fr, p[1] + 1); stroke(c, I.lo, 0.9); }
    }
    /* the bell, its scalloped margin, and its inner bell */
    c.beginPath(); c.moveTo(cx - bw / 2, rimY);
    c.bezierCurveTo(cx - bw / 2, rimY - bh * 1.33, cx + bw / 2, rimY - bh * 1.33, cx + bw / 2, rimY);
    var sc = 12;
    for (k = sc; k > 0; k--) { var x1 = cx - bw / 2 + bw * k / sc, x2 = cx - bw / 2 + bw * (k - 1) / sc; c.quadraticCurveTo((x1 + x2) / 2, rimY + 5 + x * 2, x2, rimY); }
    c.closePath(); c.fillStyle = I.plate; c.fill(); stroke(c, m, 1.4);
    c.beginPath(); c.moveTo(cx - bw * 0.4, rimY - 1); c.bezierCurveTo(cx - bw * 0.4, rimY - bh * 0.98, cx + bw * 0.4, rimY - bh * 0.98, cx + bw * 0.4, rimY - 1); stroke(c, I.lo, 1);
    /* the canals, out from the crown */
    for (k = 0; k < 8; k++) {
      var cu = (k + 0.5) / 8, ex = cx - bw * 0.46 + bw * 0.92 * cu;
      c.beginPath(); c.moveTo(cx + (cu - 0.5) * bw * 0.12, rimY - bh * 0.86); c.quadraticCurveTo(cx + (cu - 0.5) * bw * 0.7, rimY - bh * 0.7, ex, rimY - 1); stroke(c, I.lo, 0.9);
    }
    /* the four rings at its heart */
    for (k = 0; k < 4; k++) {
      var gxp = cx + (k - 1.5) * bw * 0.13, gyp = rimY - bh * 0.42;
      c.beginPath(); c.arc(gxp, gyp, bw * 0.045 * (0.85 + 0.3 * x), Math.PI * 0.15, Math.PI * 1.85); stroke(c, I.on ? I.acc : I.mid, 1.1);
    }
    /* small bubbles rising past it */
    for (k = 0; k < 5; k++) {
      var bp = (t * 0.12 + k / 5) % 1, bxp = cx + bw * (0.62 + 0.18 * rand(k)) * (k % 2 ? 1 : -1), byp = B.y + H - bp * H;
      c.beginPath(); c.arc(bxp + Math.sin(t + k) * 3, byp, 1.4 + rand(k + 3) * 1.6, 0, TAU); stroke(c, I.lo, 1, Math.sin(bp * Math.PI));
    }
  }

  var ICON = {
    bellows: '<svg viewBox="0 0 24 24"><path d="M3.5 5.5h15M3.5 18.5h15M5.5 5.5l2.2 2.2-2.2 2.1 2.2 2.2-2.2 2.1 2.2 2.2-2.2 2.2M16.5 5.5l-2.2 2.2 2.2 2.1-2.2 2.2 2.2 2.1-2.2 2.2 2.2 2.2M18.5 17.5l3 .9M10 3.5h3"/></svg>',
    lungs: '<svg viewBox="0 0 24 24"><path d="M12 2.8v7.6M12 10.4l-2.3 2.1M12 10.4l2.3 2.1"/><path d="M9.6 6.4C6.5 6.5 4.3 11 4.3 15.7c0 2.6 1.4 3.9 3.3 3.9 1.6 0 2.5-.9 2.5-2.7V8.6"/><path d="M14.4 6.4c3.1.1 5.3 4.6 5.3 9.3 0 2.6-1.4 3.9-3.3 3.9-1.6 0-2.5-.9-2.5-2.7V8.6"/></svg>',
    balloon: '<svg viewBox="0 0 24 24"><path d="M12 3c-3.7 0-6.1 2.8-6.1 6.3 0 3.9 3.3 6.9 6.1 7.9 2.8-1 6.1-4 6.1-7.9C18.1 5.8 15.7 3 12 3z"/><path d="M10.9 17.4h2.2L12 18.8zM12 18.8c-1.5 1-.2 1.8-1 3"/><path d="M8.7 7.6c.4-1.2 1.3-2 2.4-2.3"/></svg>',
    accordion: '<svg viewBox="0 0 24 24"><rect x="2.2" y="5.5" width="4.6" height="13" rx="1.1"/><rect x="17.2" y="5.5" width="4.6" height="13" rx="1.1"/><path d="M6.8 6.5l2.1 1.4 2.1-1.4 2.1 1.4 2.1-1.4 2 1.4M6.8 17.5l2.1-1.4 2.1 1.4 2.1-1.4 2.1 1.4 2-1.4M8.9 7.9v8.2M13.1 7.9v8.2M11 6.5v11M15.2 6.5v11"/></svg>',
    tide: '<svg viewBox="0 0 24 24"><circle cx="7" cy="6.5" r="2.6"/><path d="M2.5 14.2c2-1.6 3.6-1.6 5.6 0s3.6 1.6 5.6 0 3.6-1.6 5.6 0M2.5 18.4c2-1.6 3.6-1.6 5.6 0s3.6 1.6 5.6 0M15.5 20.5c1.5-3 3.5-6 6-8"/></svg>',
    jellyfish: '<svg viewBox="0 0 24 24"><path d="M5 12.4C5 7.7 8.1 4.4 12 4.4s7 3.3 7 8c-1.2.8-2.3-.6-3.5.2-1.2.8-2.3-.6-3.5.2-1.2-.8-2.3.6-3.5-.2-1.2-.8-2.3.6-3.5-.2z"/><path d="M8 13.6c.6 2-1 3.5 0 6.2M12 13.8c.6 2-1 3.6 0 6.7M16 13.6c.6 2-1 3.5 0 6.2"/></svg>'
  };
  var DRAW = { bellows: bellows, lungs: lungs, balloon: balloon, accordion: accordion, tide: tide, jellyfish: jellyfish };
  window.BREATH_SHAPES = {
    list: ['bellows', 'lungs', 'balloon', 'accordion', 'tide', 'jellyfish'],
    icon: ICON,
    draw: function (name, c, box, x, t, ink, vel) {
      var f = DRAW[name] || bellows;
      c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
      f(c, box, clamp(x, 0, 1), t, ink, vel || 0);
      c.restore();
    }
  };
})();
