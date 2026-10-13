/* balatro-ground.js — the paint behind the page.
 *
 * A WebGL port of the swirling paint that Balatro plays its cards over:
 * pixel-filtered, spun about the centre, folded five times, posterised
 * into two tones and a shadow. Here it is kept calm: every variant is
 * one colour in two lightnesses and a shadow, and the paint only moves
 * when the reader scrolls. A little scroll turns it a little; a fast
 * scroll turns it a lot, and it settles again. A background hue from
 * the colour slider rotates every variant together; 0 leaves each one
 * as designed.
 *
 *   BalatroGround.mount({ scale, variant, hue })   the canvas behind the page
 *   BalatroGround.set('hero')                      the variant to drift toward
 *   BalatroGround.hue(120)                         rotate the palette, 0 = as designed
 *   BalatroGround.push(pixels)                     scrolling: feed it the distance moved
 *   BalatroGround.enable(false)                    stop and hide the paint
 */
(function () {
  'use strict';
  /* h = hue, s = saturation, l1/l2/l3 = the two tones and the shadow */
  var VARIANTS = {
    hero:      { h: 142, s: 46, l: [0.30, 0.17, 0.06], spin: -2.0, speed: 7.0, contrast: 2.6, light: 0.16, amount: 0.25, pixel: 720 },
    apps:      { h: 158, s: 42, l: [0.28, 0.16, 0.06], spin: -1.5, speed: 5.5, contrast: 2.4, light: 0.14, amount: 0.28, pixel: 600 },
    join:      { h: 126, s: 40, l: [0.31, 0.18, 0.07], spin:  2.0, speed: 6.5, contrast: 2.6, light: 0.16, amount: 0.22, pixel: 680 },
    carry:     { h: 118, s: 40, l: [0.30, 0.17, 0.06], spin:  1.4, speed: 6.0, contrast: 2.5, light: 0.15, amount: 0.24, pixel: 640 },
    practice:  { h: 172, s: 44, l: [0.29, 0.16, 0.06], spin: -2.5, speed: 8.0, contrast: 2.8, light: 0.15, amount: 0.30, pixel: 780 },
    skills:    { h: 112, s: 38, l: [0.30, 0.17, 0.06], spin:  1.7, speed: 6.0, contrast: 2.4, light: 0.14, amount: 0.24, pixel: 560 },
    people:    { h: 150, s: 46, l: [0.32, 0.18, 0.07], spin: -1.2, speed: 7.5, contrast: 2.7, light: 0.16, amount: 0.26, pixel: 660 },
    theory:    { h: 96,  s: 36, l: [0.29, 0.16, 0.06], spin:  2.4, speed: 6.5, contrast: 2.8, light: 0.14, amount: 0.32, pixel: 860 },
    research:  { h: 136, s: 42, l: [0.30, 0.17, 0.06], spin: -1.8, speed: 5.0, contrast: 2.5, light: 0.15, amount: 0.25, pixel: 620 },
    hire:      { h: 180, s: 40, l: [0.28, 0.16, 0.06], spin:  1.3, speed: 6.0, contrast: 2.6, light: 0.14, amount: 0.24, pixel: 700 },
    subscribe: { h: 120, s: 44, l: [0.31, 0.18, 0.07], spin: -2.2, speed: 7.0, contrast: 2.7, light: 0.16, amount: 0.27, pixel: 740 },
  };
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 uRes;uniform float uTime;',
    'uniform vec3 uC1,uC2,uC3;',
    'uniform float uSpin,uSpeed,uContrast,uLight,uAmount,uPixel;',
    'void main(){',
    '  vec2 sc=gl_FragCoord.xy;',
    '  float pixel_size=length(uRes)/uPixel;',
    '  vec2 uv=(floor(sc*(1./pixel_size))*pixel_size-0.5*uRes)/length(uRes);',
    '  float uv_len=length(uv);',
    '  float speed=uSpin*0.2+302.2;',
    '  float ang=atan(uv.y,uv.x)+speed-20.*(uAmount*uv_len+(1.-uAmount));',
    '  vec2 mid=(uRes/length(uRes))/2.;',
    '  uv=vec2(uv_len*cos(ang)+mid.x,uv_len*sin(ang)+mid.y)-mid;',
    '  uv*=30.;',
    '  speed=uTime*uSpeed;',
    '  vec2 uv2=vec2(uv.x+uv.y);',
    '  for(int i=0;i<5;i++){',
    '    uv2+=sin(max(uv.x,uv.y))+uv;',
    '    uv+=0.5*vec2(cos(5.1123314+0.353*uv2.y+speed*0.131121),sin(uv2.x-0.113*speed));',
    '    uv-=cos(uv.x+uv.y)-sin(uv.x*0.711-uv.y);',
    '  }',
    '  float cm=(0.25*uContrast+0.5*uAmount+1.2);',
    '  float pr=min(2.,max(0.,length(uv)*0.035*cm));',
    '  float c1p=max(0.,1.-cm*abs(1.-pr));',
    '  float c2p=max(0.,1.-cm*abs(pr));',
    '  float c3p=1.-min(1.,c1p+c2p);',
    '  float light=(uLight-0.2)*max(c1p*5.-4.,0.)+uLight*max(c2p*5.-4.,0.);',
    '  vec3 col=(0.3/uContrast)*uC1+(1.-0.3/uContrast)*(uC1*c1p+uC2*c2p+c3p*uC3)+light;',
    /* the table edge: darker toward the rim */
    '  vec2 q=sc/uRes-0.5;',
    '  float vig=smoothstep(0.95,0.25,length(q)*1.35);',
    '  col*=mix(0.5,1.0,vig);',
    /* a breath of grain so the flats never band */
    '  float g=fract(sin(dot(floor(sc/pixel_size),vec2(12.9898,78.233)))*43758.5453);',
    '  col+=(g-0.5)*0.03;',
    '  gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  var canvas = null, gl = null, prog = null, U = {}, raf = null;
  var cur = null, target = null, hue = 0, enabled = true, scale = 0.5, mounted = false;
  var phase = 0, vel = 0;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    var f = function (n) {
      var k = (n + h / 30) % 12;
      var a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return [f(0), f(8), f(4)];
  }
  function flat(v) {
    var h = v.h + hue, s = v.s / 100;
    var c1 = hsl2rgb(h, s, v.l[0]), c2 = hsl2rgb(h, s, v.l[1]), c3 = hsl2rgb(h, s, v.l[2]);
    return [c1[0], c1[1], c1[2], c2[0], c2[1], c2[2], c3[0], c3[1], c3[2],
      v.spin, v.speed, v.contrast, v.light, v.amount, v.pixel];
  }
  function ensure() {
    if (canvas) return true;
    canvas = document.createElement('canvas');
    canvas.id = 'balatroGround';
    canvas.setAttribute('aria-hidden', 'true');
    /* the canvas stands on the paint's own darkest tone, so a moment with nothing drawn is dark, never white */
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;' +
      'pointer-events:none;display:block;image-rendering:pixelated;background:#0b0c0a;';
    document.body.insertBefore(canvas, document.body.firstChild);
    /* the browser takes a WebGL context back when too many are open (every window of the Engine paints its own)
       or when the graphics chip resets. Losing it left the paint blank white; now the loss is caught, the
       dark ground shows meanwhile, and the paint is built again the moment the context is given back. */
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; prog = null; }, false);
    canvas.addEventListener('webglcontextrestored', function () { build(); settled = false; }, false);
    window.addEventListener('resize', size);
    return build();
  }
  function build() {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) ||
         canvas.getContext('experimental-webgl');
    if (!gl || gl.isContextLost()) { gl = null; return false; }
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) { gl = null; return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var p = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uC1', 'uC2', 'uC3', 'uSpin', 'uSpeed', 'uContrast', 'uLight', 'uAmount', 'uPixel']
      .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    size();
    return true;
  }
  /* back to the tab, the paint is drawn at once rather than waiting for its next turn */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { settled = false; if (canvas && (!gl || gl.isContextLost())) build(); } });
  function size() {
    if (!canvas) return;
    var w = Math.max(160, Math.round(window.innerWidth * scale));
    var h = Math.max(160, Math.round(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; settled = false; }
    if (gl) gl.viewport(0, 0, w, h);
  }
  var last = 0, settled = false, lastDraw = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!enabled || !target) return;
    if (!gl || gl.isContextLost()) { if (canvas && now - last > 2000) { last = now; build(); } return; }
    if (now - last < 33) return;
    last = now;
    if (!cur) cur = target.slice();
    var moving = false;
    for (var i = 0; i < cur.length; i++) {
      var d = target[i] - cur[i];
      if (Math.abs(d) > 1e-4) moving = true;
      cur[i] += d * 0.05;
    }
    /* the scroll turns the paint, and the turn dies away */
    phase += vel;
    vel *= 0.86;
    if (Math.abs(vel) < 0.00005) vel = 0;
    if (!moving && vel === 0 && settled && now - lastDraw < 1500) return;
    settled = !moving && vel === 0;
    lastDraw = now;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, 6.0 + phase);
    gl.uniform3f(U.uC1, cur[0], cur[1], cur[2]);
    gl.uniform3f(U.uC2, cur[3], cur[4], cur[5]);
    gl.uniform3f(U.uC3, cur[6], cur[7], cur[8]);
    canvas.style.background = 'rgb(' + Math.round(cur[6] * 255) + ',' + Math.round(cur[7] * 255) + ',' + Math.round(cur[8] * 255) + ')';
    gl.uniform1f(U.uSpin, cur[9]);
    gl.uniform1f(U.uSpeed, cur[10]);
    gl.uniform1f(U.uContrast, cur[11]);
    gl.uniform1f(U.uLight, cur[12]);
    gl.uniform1f(U.uAmount, cur[13]);
    gl.uniform1f(U.uPixel, cur[14]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  var api = {
    VARIANTS: VARIANTS,
    mount: function (opts) {
      opts = opts || {};
      if (opts.scale) scale = opts.scale;
      if (mounted) return api;
      mounted = true;
      if (!ensure()) { document.documentElement.classList.add('no-ground'); return api; }
      if (opts.variant) api.set(opts.variant);
      if (opts.hue) api.hue(opts.hue);
      if (opts.enabled === false) api.enable(false);
      if (!raf) raf = requestAnimationFrame(frame);
      return api;
    },
    set: function (name) {
      var v = VARIANTS[name] || VARIANTS.hero;
      api._name = name;
      target = flat(v);
      settled = false;
      return api;
    },
    hue: function (deg) {
      hue = parseInt(deg, 10) || 0;
      if (api._name) target = flat(VARIANTS[api._name] || VARIANTS.hero);
      settled = false;
      return api;
    },
    push: function (px) {
      if (reduced) return api;
      vel += Math.min(Math.abs(px), 400) * 0.00012;
      settled = false;
      return api;
    },
    enable: function (on) {
      enabled = on !== false;
      settled = false;
      if (canvas) canvas.style.display = enabled ? 'block' : 'none';
      document.documentElement.classList.toggle('grounded', enabled && !!gl);
      return api;
    },
    ok: function () { return !!gl; }
  };
  window.BalatroGround = api;
})();
