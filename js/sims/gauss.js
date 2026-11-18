// Ley de Gauss con esferas: maciza o casquete, conductora o no conductora.
(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar, SimCanvas, drawGrid, arrow, label, COLORS, fmt, si, K, EPS0 } = CA;
mountNavbar();

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const NC = 1e-9, CM = 0.01, SCALE = 24, A_RATIO = 0.5; // el mundo está en cm
const S = { shape: 'maciza', mat: 'dielectrico', Q: 8, R: 5, r: 2.5, P: { x: 6, y: 3 }, grid: true };
const cond = () => S.mat === 'conductor', shell = () => S.shape === 'casquete';
const aOf = () => (shell() ? S.R * A_RATIO : 0);

// ---------- Física (r en cm) ----------
function qenc(r) {
  const { R, Q } = S, a = aOf();
  if (r >= R) return Q;
  if (cond()) return 0;                                   // la carga del conductor está en la superficie
  if (!shell()) return Q * (r / R) ** 3;                  // maciza no conductora: carga en el volumen
  return r < a ? 0 : (Q * (r ** 3 - a ** 3)) / (R ** 3 - a ** 3);
}
const Eof = (r) => (r > 0 ? (K * qenc(r) * NC) / (r * CM) ** 2 : 0); // N/C (signo de Q: + hacia afuera)
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
const dirOut = () => (S.Q >= 0 ? 1 : -1);
const Eref = () => Math.abs((K * S.Q * NC) / (S.R * CM) ** 2);
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
  $('spd').textContent = EP === 0 ? 'sin campo (E = 0)' : dirOut() > 0 ? 'radial, hacia afuera' : 'radial, hacia adentro';
  $('regions').innerHTML = R.map(([rid, n, f]) => `<div class="reg${rid === id ? ' active' : ''}"><b>${n}</b><code>${f}</code>${rid === id ? `<span class="val">r = ${fmt(S.r)} cm → E = ${fmt(Math.abs(E))} N/C</span>` : ''}</div>`).join('');
  $('formula').textContent = `r = ${fmt(S.r)} cm = ${fmt(S.r * CM)} m\nQ_enc = ${fmt(q)} nC\nΦ = Q_enc/ε₀ = ${fmt((q * NC) / EPS0)} N·m²/C\nE = Φ/(4πr²) = ${fmt(Math.abs(E))} N/C`;
}
function syncControls() {
  $('shape').value = S.shape; $('mat').value = S.mat;
  [['Q', S.Q], ['R', S.R], ['rg', S.r], ['px', S.P.x], ['py', S.P.y]].forEach(([id, v]) => { $(id).value = v; });
  $('vec').checked = S.grid; refresh();
}
['shape', 'mat'].forEach((id) => ['input', 'change'].forEach((ev) => $(id).addEventListener(ev, () => { S[id] = $(id).value; refresh(); })));
[['Q', (v) => (S.Q = v)], ['R', (v) => (S.R = v)], ['rg', (v) => (S.r = v)], ['px', (v) => (S.P.x = v)], ['py', (v) => (S.P.y = v)]]
  .forEach(([id, set]) => $(id).addEventListener('input', () => { set(+$(id).value); refresh(); }));
$('vec').addEventListener('change', () => { S.grid = $('vec').checked; });
$('exercise').addEventListener('click', () => { Object.assign(S, { shape: 'maciza', mat: 'dielectrico', Q: 8, R: 5, r: 2.5 }); syncControls(); });

// ---------- Dibujo ----------
function marks(ctx, c, sc) {
  const N = 36, R = S.R * sc, a = aOf() * sc;
  ctx.fillStyle = S.Q >= 0 ? COLORS.pos : COLORS.neg;
  for (let i = 0; i < N; i++) {
    let rr, th = i * 2.399963;
    if (cond()) { rr = R; th = (i / N) * 2 * Math.PI; } else rr = Math.sqrt(a * a + (R * R - a * a) * ((i + 0.5) / N));
    ctx.beginPath(); ctx.arc(c.x + rr * Math.cos(th), c.y - rr * Math.sin(th), 3.5, 0, 7); ctx.fill();
  }
}
function draw(ctx, e) {
  drawGrid(ctx, e, 1);
  const c = e.toScreen(0, 0), sc = e.scale, R = S.R * sc, a = aOf() * sc, d = dirOut();
  if (S.grid) {
    const b = e.bounds, st = 2.5;
    for (let gx = Math.ceil(b.xmin / st) * st; gx <= b.xmax; gx += st) for (let gy = Math.ceil(b.ymin / st) * st; gy <= b.ymax; gy += st) {
      const r = Math.hypot(gx, gy), L = Lof(Eof(r)) * 0.7; if (r < 0.4 || !L) continue;
      const s = e.toScreen(gx, gy);
      arrow(ctx, s.x, s.y, s.x + (d * gx / r) * L, s.y - (d * gy / r) * L, { color: 'rgba(167,139,250,.75)', width: 1.6, head: 6 });
    }
  }
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, 7);
  ctx.fillStyle = cond() ? 'rgba(160,170,190,.55)' : 'rgba(129,140,248,.25)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = cond() ? '#cbd5e1' : '#818cf8'; ctx.stroke();
  if (a > 0) { ctx.beginPath(); ctx.arc(c.x, c.y, a, 0, 7); ctx.fillStyle = COLORS.stage; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  marks(ctx, c, sc);
  const gr = S.r * sc;                                          // superficie gaussiana (la esfera queda fija)
  ctx.save(); ctx.setLineDash([9, 6]); ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.force;
  ctx.beginPath(); ctx.arc(c.x, c.y, gr, 0, 7); ctx.stroke(); ctx.restore();
  const L = Lof(Eof(S.r));
  if (L) for (let k = 0; k < 16; k++) {
    const t = (k / 16) * 2 * Math.PI, ux = Math.cos(t), uy = -Math.sin(t), x = c.x + gr * ux, y = c.y + gr * uy;
    arrow(ctx, x, y, x + d * ux * L, y + d * uy * L, { color: COLORS.force, width: 2.5, head: 8 });
  }
  const P = e.toScreen(S.P.x, S.P.y), rP = Math.hypot(S.P.x, S.P.y), EP = Eof(rP), LP = Lof(EP) * 1.2;
  ctx.save(); ctx.setLineDash([4, 5]); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(P.x, P.y); ctx.stroke(); ctx.restore();
  if (rP > 0.01 && LP) arrow(ctx, P.x, P.y, P.x + (d * S.P.x / rP) * LP, P.y - (d * S.P.y / rP) * LP, { color: '#fff', width: 3.5, head: 11 });
  ctx.beginPath(); ctx.arc(P.x, P.y, 7, 0, 7); ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  label(ctx, `P: ${fmt(Math.abs(EP))} N/C`, P.x + 14, P.y - 14, { align: 'left' });
  label(ctx, `R = ${fmt(S.R)} cm`, c.x, c.y + R + 18, { color: COLORS.textDim });
  label(ctx, `r = ${fmt(S.r)} cm`, c.x, c.y - gr - 10, { color: COLORS.force });
}
function onDown(p) {
  S.P.x = clamp(Math.round(p.x * 10) / 10, -15, 15); S.P.y = clamp(Math.round(p.y * 10) / 10, -10, 10);
  $('px').value = S.P.x; $('py').value = S.P.y; refresh();
}
new SimCanvas($('stage'), { scale: SCALE, draw, onDown }).start();
syncControls();
})();
