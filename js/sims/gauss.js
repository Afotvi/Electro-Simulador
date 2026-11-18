// Ley de Gauss con esferas: maciza o casquete, conductora o no conductora.
//
// Animaciones (todas en el canvas, sin librerías):
//  · Los valores se suavizan: Q, R, r y P se desplazan con easing en vez de saltar.
//  · Al cambiar forma/material, las flechas del campo se mezclan (fundido) y las cargas migran
//    (del volumen a la superficie en un conductor).
//  · Flujo del campo: partículas que viajan por las líneas radiales (hacia afuera si Q>0, hacia adentro si Q<0).
//  · La superficie gaussiana tiene línea que avanza, "respira" y resalta la carga que encierra.
//  · Onda al cruzar r = R y pulso en el punto P.
//  · Botón «Barrer la superficie»: r sube y baja solo, con los resultados en vivo.
// Con «reducir movimiento» del sistema, las animaciones arrancan apagadas y los cambios son instantáneos.
(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar, SimCanvas, drawGrid, arrow, label, COLORS, fmt, si, K, EPS0 } = CA;
mountNavbar();

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const NC = 1e-9, CM = 0.01, SCALE = 24, A_RATIO = 0.5; // el mundo está en cm
const R_MIN = 0.5, R_MAX = 10, SWEEP_SPEED = 1.6;       // límites de r y velocidad del barrido (cm/s)
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// S = estado "real" (lo que muestran los resultados). D = estado "dibujado", que persigue a S con suavidad.
const S = { shape: 'maciza', mat: 'dielectrico', Q: 8, R: 5, r: 2.5, P: { x: 6, y: 3 }, grid: true, anim: !REDUCED, sweep: false, sdir: 1 };
const D = { shape: S.shape, mat: S.mat, Q: S.Q, R: S.R, r: S.r, a: 0, P: { x: S.P.x, y: S.P.y }, m: 1, old: null };
const F = { phase: 0, side: 0, flash: null, acc: 0 };          // flujo, cruce de R, refresco del panel

// ---------- Física (r en cm). `s` es cualquier estado con { shape, mat, Q, R } ----------
const cond = (s = S) => s.mat === 'conductor', shell = (s = S) => s.shape === 'casquete';
const aOf = (s = S) => (shell(s) ? s.R * A_RATIO : 0);
function qenc(r, s = S) {
  const { R, Q } = s, a = aOf(s);
  if (r >= R) return Q;
  if (cond(s)) return 0;                                  // la carga del conductor está en la superficie
  if (!shell(s)) return Q * (r / R) ** 3;                 // maciza no conductora: carga en el volumen
  return r < a ? 0 : (Q * (r ** 3 - a ** 3)) / (R ** 3 - a ** 3);
}
const Eof = (r, s = S) => (r > 0 ? (K * qenc(r, s) * NC) / (r * CM) ** 2 : 0); // N/C; el signo de Q indica hacia afuera (+) o adentro (−)
function regionId(r) {
  if (Math.abs(r - S.R) < 0.05) return 'surf';
  if (r > S.R) return 'out';
  if (shell() && !cond()) return r < aOf() ? 'cav' : 'mat';
  return 'in';
}
function rows() {
  const zero = 'Q_enc = 0  →  E = 0', out = [];
  if (shell() && !cond()) out.push(['cav', 'Cavidad (r < a)', zero], ['mat', 'En el material (a < r < R)', 'Q_enc = Q(r³ − a³)/(R³ − a³)  →  E = k·Q_enc/r²']);
  else out.push(['in', 'Adentro (r < R)', cond() ? zero : 'Q_enc = Q·r³/R³  →  E = kQr/R³']);
  out.push(['surf', 'En la superficie (r = R)', 'Q_enc = Q  →  E = kQ/R²' + (cond() ? '  (salta de 0 a este valor)' : '')],
           ['out', 'Afuera (r > R)', 'Q_enc = Q  →  E = kQ/r²']);
  return out;
}

// ---------- Campo "dibujado": mezcla el estado anterior con el nuevo mientras dura el cambio de forma/material ----------
const Edraw = (r) => (D.m >= 1 || !D.old ? Eof(r, D) : (1 - D.m) * Eof(r, D.old) + D.m * Eof(r, D));
const Eref = () => Math.abs((K * Math.max(Math.abs(D.Q), 0.5) * NC) / (D.R * CM) ** 2);
const Lof = (E) => { const m = Eref(), x = m ? Math.abs(E) / m : 0; return x < 1e-6 ? 0 : 10 + 40 * Math.min(1, x) ** 0.45; };

// ---------- Panel y resultados ----------
function refresh() {
  $('Qv').textContent = fmt(S.Q) + ' nC'; $('Rv').textContent = fmt(S.R) + ' cm'; $('rgv').textContent = fmt(S.r) + ' cm';
  $('pxv').textContent = fmt(S.P.x) + ' cm'; $('pyv').textContent = fmt(S.P.y) + ' cm';
  const q = qenc(S.r), E = Eof(S.r), id = regionId(S.r), R = rows();
  $('sreg').textContent = R.find((x) => x[0] === id)[1].split(' (')[0];
  $('sq').textContent = si(q * NC, 'C'); $('sphi').textContent = fmt((q * NC) / EPS0) + ' N·m²/C'; $('sE').textContent = fmt(Math.abs(E)) + ' N/C';
  const rP = Math.hypot(S.P.x, S.P.y), EP = Eof(rP);
  $('spE').textContent = fmt(Math.abs(EP)) + ' N/C';
  $('spd').textContent = EP === 0 ? 'sin campo (E = 0)' : S.Q > 0 ? 'radial, hacia afuera' : 'radial, hacia adentro';
  $('regions').innerHTML = R.map(([rid, n, f]) => `<div class="reg${rid === id ? ' active' : ''}"><b>${n}</b><code>${f}</code>${rid === id ? `<span class="val">r = ${fmt(S.r)} cm → E = ${fmt(Math.abs(E))} N/C</span>` : ''}</div>`).join('');
  $('formula').textContent = `r = ${fmt(S.r)} cm = ${fmt(S.r * CM)} m\nQ_enc = ${fmt(q)} nC\nΦ = Q_enc/ε₀ = ${fmt((q * NC) / EPS0)} N·m²/C\nE = Φ/(4πr²) = ${fmt(Math.abs(E))} N/C`;
}
function setSweep(on) {
  S.sweep = on;
  const b = $('sweep'); b.setAttribute('aria-pressed', on); b.textContent = on ? '⏸ Detener el barrido' : '▶ Barrer la superficie';
  if (on) { if (S.r >= R_MAX) S.sdir = -1; else if (S.r <= R_MIN) S.sdir = 1; }
}
// Cambiar forma/material con transición: guarda el estado anterior para fundir el campo y hacer migrar las cargas.
function setMaterial(shape, mat) {
  if (shape === S.shape && mat === S.mat) return;
  if (!REDUCED) { D.old = { shape: D.shape, mat: D.mat, Q: D.Q, R: D.R }; D.m = 0; }
  S.shape = shape; S.mat = mat; D.shape = shape; D.mat = mat;
}
function syncControls() {
  $('shape').value = S.shape; $('mat').value = S.mat;
  [['Q', S.Q], ['R', S.R], ['rg', S.r], ['px', S.P.x], ['py', S.P.y]].forEach(([id, v]) => { $(id).value = v; });
  $('vec').checked = S.grid; $('anim').checked = S.anim; refresh();
}
['shape', 'mat'].forEach((id) => ['input', 'change'].forEach((ev) => $(id).addEventListener(ev, () => {
  setMaterial(id === 'shape' ? $('shape').value : S.shape, id === 'mat' ? $('mat').value : S.mat); refresh();
})));
[['Q', (v) => (S.Q = v)], ['R', (v) => (S.R = v)], ['rg', (v) => { S.r = v; if (S.sweep) setSweep(false); }], ['px', (v) => (S.P.x = v)], ['py', (v) => (S.P.y = v)]]
  .forEach(([id, set]) => $(id).addEventListener('input', () => { set(+$(id).value); refresh(); }));
$('vec').addEventListener('change', () => { S.grid = $('vec').checked; });
$('anim').addEventListener('change', () => { S.anim = $('anim').checked; });
$('sweep').addEventListener('click', () => { if (!S.sweep && !S.anim) { S.anim = true; $('anim').checked = true; } setSweep(!S.sweep); });
$('exercise').addEventListener('click', () => {
  setMaterial('maciza', 'dielectrico'); Object.assign(S, { Q: 8, R: 5, r: 2.5 }); if (S.sweep) setSweep(false); syncControls();
});

// ---------- Cargas de la esfera (36 puntos) ----------
// Cada punto tiene un radio "objetivo" según la forma/material y se mueve hacia él. En un no conductor el radio sale de
// la distribución en volumen (r ∝ ∛u), así la cantidad de puntos encerrados es proporcional a Q_enc(r) = Q·(r/R)³.
const N = 36, GOLD = 2.399963;
const dots = Array.from({ length: N }, (_, i) => ({ i, u: (i + 0.5) / N, th: i * GOLD, rr: null }));
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
function dotTarget(d, t) {
  const R = S.R, a = aOf();
  if (cond()) return { rr: R, th: (d.i / N) * 2 * Math.PI + t * 0.12 };      // cargas libres: se reparten por la superficie
  return { rr: Math.cbrt(a ** 3 + (R ** 3 - a ** 3) * d.u), th: d.i * GOLD };  // cargas fijas en el volumen
}

// ---------- Actualización (se llama en cada cuadro) ----------
function update(dt, e) {
  e.scale = Math.max(SCALE, Math.min(e.w, e.h) / 23);              // en pantalla completa la simulación crece
  const k = REDUCED ? 1 : 1 - Math.exp(-dt * 12), kd = REDUCED ? 1 : 1 - Math.exp(-dt * 5);
  const ease = (cur, to) => (Math.abs(to - cur) < 1e-4 ? to : cur + (to - cur) * k);
  D.Q = ease(D.Q, S.Q); D.R = ease(D.R, S.R); D.r = ease(D.r, S.r); D.a = ease(D.a, aOf());
  D.P.x = ease(D.P.x, S.P.x); D.P.y = ease(D.P.y, S.P.y);
  if (D.m < 1) D.m = Math.min(1, D.m + dt / 0.6);

  if (S.sweep) {                                                  // barrido automático de la superficie gaussiana
    S.r += S.sdir * SWEEP_SPEED * dt;
    if (S.r >= R_MAX) { S.r = R_MAX; S.sdir = -1; } else if (S.r <= R_MIN) { S.r = R_MIN; S.sdir = 1; }
    $('rg').value = S.r;
    F.acc += dt; if (F.acc > 0.05) { F.acc = 0; refresh(); }
  }
  if (S.anim) F.phase += (S.Q >= 0 ? 1 : -1) * dt * 1.1;          // el flujo avanza hacia afuera (Q>0) o hacia adentro (Q<0)

  const side = Math.sign(D.r - D.R);                              // onda cuando la superficie gaussiana cruza r = R
  if (S.anim && F.side && side && side !== F.side) F.flash = 0;
  if (side) F.side = side;
  if (F.flash !== null) { F.flash += dt; if (F.flash > 0.9) F.flash = null; }

  dots.forEach((d) => {                                           // migración de las cargas
    const t = dotTarget(d, e.time);
    if (d.rr === null) { d.rr = t.rr; d.th = t.th; return; }
    d.rr += (t.rr - d.rr) * kd; d.th += wrap(t.th - d.th) * kd;
  });
}

// ---------- Dibujo ----------
function tag(ctx, text, x, y, { color = '#fff', align = 'center' } = {}) {   // etiqueta con fondo para que se lea sobre las flechas
  ctx.font = '600 13px system-ui';
  const w = ctx.measureText(text).width + 14, h = 22, x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2, r = 8;
  ctx.fillStyle = 'rgba(14,18,38,.82)';
  ctx.beginPath(); ctx.moveTo(x0 + r, y - h / 2); ctx.arcTo(x0 + w, y - h / 2, x0 + w, y + h / 2, r); ctx.arcTo(x0 + w, y + h / 2, x0, y + h / 2, r);
  ctx.arcTo(x0, y + h / 2, x0, y - h / 2, r); ctx.arcTo(x0, y - h / 2, x0 + w, y - h / 2, r); ctx.closePath(); ctx.fill();
  label(ctx, text, x0 + w / 2, y + 0.5, { color });
}
function sphereBody(ctx, c, R, isCond, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7);
  ctx.fillStyle = isCond ? 'rgba(160,170,190,.55)' : 'rgba(129,140,248,.25)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = isCond ? '#cbd5e1' : '#818cf8'; ctx.stroke();
  ctx.globalAlpha = 1;
}
function marks(ctx, c, sc, e) {
  const q = S.Q >= 0 ? COLORS.pos : COLORS.neg, isCond = cond();
  dots.forEach((d) => {
    const x = c.x + d.rr * sc * Math.cos(d.th), y = c.y - d.rr * sc * Math.sin(d.th);
    const inside = isCond ? S.r >= S.R : d.rr <= D.r;              // ¿la encierra la superficie gaussiana?
    const pulse = S.anim ? 0.5 + 0.5 * Math.sin(e.time * 3 + d.i) : 0.5;
    if (inside && Math.abs(S.Q) > 0) {                             // halo: esta carga cuenta en Q_enc
      const g = ctx.createRadialGradient(x, y, 1, x, y, 13 + 3 * pulse);
      g.addColorStop(0, q + 'aa'); g.addColorStop(1, q + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
    }
    ctx.fillStyle = q; ctx.beginPath(); ctx.arc(x, y, 3.5 + (inside ? 0.8 * pulse : 0), 0, 7); ctx.fill();
  });
}
function flow(ctx, c, e) {                                         // partículas que viajan por las líneas radiales
  const b = e.bounds, rmax = Math.hypot(b.xmax, b.ymax) + 1, SP = 2.2, n = Math.ceil(rmax / SP), rays = 24, sc = e.scale;
  const dirS = S.Q >= 0 ? 1 : -1;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#d8ccff'; ctx.lineWidth = 2;
  for (let j = 0; j < rays; j++) {
    const t = (j / rays) * 2 * Math.PI, ux = Math.cos(t), uy = -Math.sin(t), off = (j * 0.381966) % 1;
    for (let kk = 0; kk < n; kk++) {
      const rho = ((((kk + F.phase + off) % n) + n) % n) * SP;
      if (rho < 0.5) continue;
      const E = Edraw(rho); if (Math.abs(E) < 1e-9) continue;
      const x = c.x + rho * sc * ux, y = c.y + rho * sc * uy;
      const ends = Math.min(1, rho / 1.5, (rmax - rho) / 3);
      ctx.globalAlpha = Math.max(0, ends) * (0.2 + 0.6 * Math.min(1, Math.abs(E) / Eref()) ** 0.45);
      ctx.beginPath(); ctx.moveTo(x - dirS * ux * 9, y - dirS * uy * 9); ctx.lineTo(x, y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function draw(ctx, e) {
  drawGrid(ctx, e, 1);
  const c = e.toScreen(0, 0), sc = e.scale, R = D.R * sc, a = D.a * sc, t = e.time;

  if (S.grid) {                                                    // cuadrícula de vectores
    const b = e.bounds, st = 2.5;
    for (let gx = Math.ceil(b.xmin / st) * st; gx <= b.xmax; gx += st) for (let gy = Math.ceil(b.ymin / st) * st; gy <= b.ymax; gy += st) {
      const r = Math.hypot(gx, gy); if (r < 0.4) continue;
      const E = Edraw(r), L = Lof(E) * 0.7; if (!L) continue;
      const d = Math.sign(E), s = e.toScreen(gx, gy);
      arrow(ctx, s.x, s.y, s.x + (d * gx / r) * L, s.y - (d * gy / r) * L, { color: 'rgba(167,139,250,.75)', width: 1.6, head: 6 });
    }
  }

  // esfera (con fundido entre materiales al cambiar)
  if (D.m < 1 && D.old) { sphereBody(ctx, c, R, cond(D.old), 1 - D.m); sphereBody(ctx, c, R, cond(D), D.m); }
  else sphereBody(ctx, c, R, cond(D), 1);
  if (a > 0.5) { ctx.beginPath(); ctx.arc(c.x, c.y, a, 0, 7); ctx.fillStyle = COLORS.stage; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = cond(D) ? '#cbd5e1' : '#818cf8'; ctx.stroke(); }

  if (S.anim) flow(ctx, c, e);
  marks(ctx, c, sc, e);

  // superficie gaussiana: la esfera queda fija
  const gr = D.r * sc, breathe = S.anim ? 1 + 0.07 * Math.sin(t * 3) : 1;
  ctx.beginPath(); ctx.arc(c.x, c.y, gr, 0, 7); ctx.fillStyle = 'rgba(253,224,71,.06)'; ctx.fill();
  ctx.save(); ctx.setLineDash([9, 6]); ctx.lineDashOffset = S.anim ? -t * 22 : 0; ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.force;
  ctx.beginPath(); ctx.arc(c.x, c.y, gr, 0, 7); ctx.stroke(); ctx.restore();
  if (F.flash !== null) {                                          // onda al cruzar r = R
    const p = F.flash / 0.9;
    ctx.globalAlpha = 1 - p; ctx.lineWidth = 3; ctx.strokeStyle = COLORS.force;
    ctx.beginPath(); ctx.arc(c.x, c.y, R + p * 46, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const Es = Edraw(D.r), L = Lof(Es) * breathe, ds = Math.sign(Es);
  if (L) for (let k = 0; k < 16; k++) {
    const th = (k / 16) * 2 * Math.PI, ux = Math.cos(th), uy = -Math.sin(th), x = c.x + gr * ux, y = c.y + gr * uy;
    arrow(ctx, x, y, x + ds * ux * L, y + ds * uy * L, { color: COLORS.force, width: 2.5, head: 8 });
  }

  // punto P
  const P = e.toScreen(D.P.x, D.P.y), rP = Math.hypot(D.P.x, D.P.y), EP = Edraw(rP), LP = Lof(EP) * 1.2, dP = Math.sign(EP);
  const ux = rP > 0.01 ? D.P.x / rP : 1, uy = rP > 0.01 ? -D.P.y / rP : 0;
  ctx.save(); ctx.setLineDash([4, 5]); ctx.lineDashOffset = S.anim ? -t * 12 : 0; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(P.x, P.y); ctx.stroke(); ctx.restore();
  if (S.anim) {                                                    // pulso que llama la atención sobre P
    const p = (t % 1.6) / 1.6;
    ctx.globalAlpha = 0.7 * (1 - p); ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(P.x, P.y, 8 + p * 20, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (rP > 0.01 && LP) arrow(ctx, P.x, P.y, P.x + dP * ux * LP, P.y + dP * uy * LP, { color: '#fff', width: 3.5, head: 11 });
  ctx.beginPath(); ctx.arc(P.x, P.y, 7, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  const px = -uy, py = ux;                                         // etiqueta de lado (perpendicular a la flecha), para no taparla
  tag(ctx, `P: ${fmt(Math.abs(Eof(Math.hypot(S.P.x, S.P.y))))} N/C`, P.x + px * 30 + (px >= 0 ? 6 : -6), P.y + py * 30, { align: px >= 0 ? 'left' : 'right' });

  label(ctx, `R = ${fmt(S.R)} cm`, c.x, c.y + R + 18, { color: COLORS.textDim });
  const ang = (112 * Math.PI) / 180;                               // «r = …» entre dos flechas de la superficie
  tag(ctx, `r = ${fmt(S.r)} cm`, c.x + gr * Math.cos(ang), c.y - gr * Math.sin(ang), { color: COLORS.force });
}
function onDown(p) {
  S.P.x = clamp(Math.round(p.x * 10) / 10, -15, 15); S.P.y = clamp(Math.round(p.y * 10) / 10, -10, 10);
  $('px').value = S.P.x; $('py').value = S.P.y; refresh();
}
new SimCanvas($('stage'), { scale: SCALE, update, draw, onDown }).start();
syncControls();
})();
