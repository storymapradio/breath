/* The site's five skins, as the home page wears them (facilitators/index.html):
   Studio, Paper, SOLOS (the tube over the paint), Balatro, Cassette.
   Load this in <head> before any paint. A choice made on any page that uses it,
   or on the home page, is the same choice (localStorage 'fac-skin2', or ?skin=).
   window.SKIN_KIT = { name, def, all, menu(el), plate() }  */
(function () {
  var SKINS = {
    studio:   { screen: 'flat', ground: 'none' },
    paper:    { screen: 'flat', ground: 'none' },
    solos:    { screen: 'crt',  ground: 'paint', paintHue: 258 },
    balatro:  { screen: 'flat', ground: 'paint', paintHue: 348 },
    cassette: { screen: 'flat', ground: 'none' }
  };
  var q = null, saved = null;
  try { q = new URLSearchParams(location.search).get('skin'); } catch (e) {}
  try { saved = localStorage.getItem('fac-skin2'); } catch (e) {}
  var name = SKINS[q] ? q : (SKINS[saved] ? saved : 'studio');
  if (q && SKINS[q]) { try { localStorage.setItem('fac-skin2', q); } catch (e) {} }
  var doc = document.documentElement;
  doc.dataset.skin = name;
  doc.classList.toggle('solos-crt', SKINS[name].screen === 'crt');

  function menu(holder) {
    var btn = document.createElement('button'), row = document.createElement('div');
    btn.type = 'button'; btn.id = 'skinBtn'; btn.textContent = name; btn.setAttribute('aria-haspopup', 'true'); btn.setAttribute('aria-expanded', 'false');
    row.id = 'skins'; row.hidden = true;
    row.innerHTML = '<span class="lbl">Skin</span>';
    Object.keys(SKINS).forEach(function (n) {
      var a = document.createElement('a'); a.href = '?skin=' + n + location.hash; a.textContent = n; a.className = 'skin' + (n === name ? ' on' : '');
      a.addEventListener('click', function (e) {
        e.preventDefault();
        try { localStorage.setItem('fac-skin2', n); sessionStorage.setItem('skin-y:' + location.pathname, String(window.scrollY)); } catch (x) {}
        location.search = '?skin=' + n;
      });
      row.appendChild(a);
    });
    btn.addEventListener('click', function (e) { e.stopPropagation(); row.hidden = !row.hidden; btn.setAttribute('aria-expanded', row.hidden ? 'false' : 'true'); });
    document.addEventListener('click', function (e) { if (!row.hidden && !row.contains(e.target)) { row.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    holder.appendChild(btn); holder.appendChild(row);
  }
  /* the reader keeps their place when the skin changes */
  window.addEventListener('load', function () {
    var k = 'skin-y:' + location.pathname, y = null;
    try { y = sessionStorage.getItem(k); sessionStorage.removeItem(k); } catch (e) {}
    if (y) window.scrollTo(0, +y);
  });
  /* the paint behind SOLOS and Balatro */
  function ground() {
    if (SKINS[name].ground !== 'paint' || !window.BalatroGround) return;
    BalatroGround.mount({ scale: Math.min(0.5, 800 / Math.max(window.innerWidth, 1)), variant: 'hero' });
    BalatroGround.hue(SKINS[name].paintHue);
    var lastY = window.scrollY;
    window.addEventListener('scroll', function () { var y = window.scrollY; BalatroGround.push(y - lastY); lastY = y; }, { passive: true });
  }
  window.SKIN_KIT = { name: name, def: SKINS[name], all: Object.keys(SKINS), menu: menu, ground: ground };
})();
