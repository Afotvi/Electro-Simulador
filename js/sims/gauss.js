(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { drawGrid, arrow, chargeDot } = CA;
const { fieldAt, fluxThroughSphere } = CA;
const { EPS0 } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const NC = 1e-9;
const R_PX = 14;
const MAX_CHARGES = 6;
const R_MIN = 0.2, R_MAX = 1.0;
const SPOTS = [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8], [0, 1.1], [0, -1.1]];
const GRAY = '#9aa5d1';

const PRESETS = {
  adentro: () => [{ x: 0.2, y: 0.1, q: 3 }],
  mixto:   () => [{ x: -0.2, y: 0.1, q: 2 }, { x: 1.1, y: 0.3, q: -3 }],
  dipolo:  () => [{ x: -0.2, y: 0, q: 3 }, { x: 0.2, y: 0, q: -3 }],
};

let charges = PRESETS.adentro();
let surf = { x: 0, y: 0, R: 0.6 };   // superficie gaussiana (corte de una esfera)
let selected = 0;
let dirty = true;
let drag = null;                      // { type: 'charge', c } | { type: 'resize' } | { type: 'surface', dx, dy }
let res = { qenc: 0, phiT: 0, phiN: 0, inside: [], near: false };

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dist = (c) => Math.hypot(c.x - surf.x, c.y - surf.y);

// ---------- Cálculo (solo cuando algo cambia) ----------
function recompute() {
  const inside = charges.filter((c) => dist(c) < surf.R);
  const qenc = inside.reduce((s, c) => s + c.q, 0);
  res = {
    inside, qenc,
    phiT: (qenc * NC) / EPS0,                                   // Gauss: Φ = Q_enc / ε₀
    phiN: fluxThroughSphere(charges, surf.x, surf.y, surf.R),   // integral numérica de E·dA
    near: charges.some((c) => Math.abs(dist(c) - surf.R) < 0.06),
  };
  dirty = false;
}

// ---------- Interacción ----------
const near = (e, p, wx, wy, r) => { const s = e.toScreen(wx, wy); return Math.hypot(s.x - p.sx, s.y - p.sy) < r; };

const sim = new SimCanvas($('stage'), {
  scale: 250,
  onDown(p, e) {
    const i = charges.findIndex((c) => near(e, p, c.x, c.y, R_PX * 1.6));
    if (i >= 0) { drag = { type: 'charge', c: charges[i] }; selected = i; syncControls(); return; }
    const C = e.toScreen(surf.x, surf.y), d = Math.hypot(p.sx - C.x, p.sy - C.y), Rpx = surf.R * e.scale;
    if (Math.abs(d - Rpx) < 14) drag = { type: 'resize' };                       // borde => cambiar radio
    else if (d < Rpx) drag = { type: 'surface', dx: surf.x - p.x, dy: surf.y - p.y }; // interior => mover
  },
  onMove(p, e) {
    const b = e.bounds;
    if (drag?.type === 'charge') {
      drag.c.x = clamp(p.x, b.xmin + 0.1, b.xmax - 0.1); drag.c.y = clamp(p.y, b.ymin + 0.1, b.ymax - 0.1); dirty = true;
    } else if (drag?.type === 'resize') {
      surf.R = clamp(Math.hypot(p.x - surf.x, p.y - surf.y), R_MIN, R_MAX); dirty = true; syncControls();
    } else if (drag?.type === 'surface') {
      surf.x = clamp(p.x + drag.dx, b.xmin + 0.1, b.xmax - 0.1); surf.y = clamp(p.y + drag.dy, b.ymin + 0.1, b.ymax - 0.1); dirty = true;
    } else {
      const C = e.toScreen(surf.x, surf.y), d = Math.hypot(p.sx - C.x, p.sy - C.y), Rpx = surf.R * e.scale;
      const overCharge = charges.some((c) => near(e, p, c.x, c.y, R_PX * 1.6));
      e.canvas.style.cursor = overCharge ? 'grab' : Math.abs(d - Rpx) < 14 ? 'nesw-resize' : d < Rpx ? 'move' : 'default';
    }
  },
  onUp(_p, e) { drag = null; e.canvas.style.cursor = 'default'; },

  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    drawGrid(ctx, e, 0.5);
    if (dirty) recompute();

    // superficie gaussiana: color según el signo del flujo
    const tint = res.phiT > 0 ? COLORS.pos : res.phiT < 0 ? COLORS.neg : GRAY;
    const C = e.toScreen(surf.x, surf.y), Rpx = surf.R * e.scale;
    ctx.fillStyle = tint + '18'; ctx.beginPath(); ctx.arc(C.x, C.y, Rpx, 0, Math.PI * 2); ctx.fill();
    ctx.setLineDash([9, 7]); ctx.strokeStyle = tint; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(C.x, C.y, Rpx, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);

    // campo sobre la superficie: rojo = sale (flujo +), azul = entra (flujo −)
    const N = 28;
    for (let k = 0; k < N; k++) {
      const a = (2 * Math.PI * k) / N;
      const px = surf.x + surf.R * Math.cos(a), py = surf.y + surf.R * Math.sin(a);
      const f = fieldAt(charges, px, py), m = Math.hypot(f.ex, f.ey);
      if (m === 0) continue;
      const en = f.ex * Math.cos(a) + f.ey * Math.sin(a);               // componente normal (en el plano)
      const color = Math.abs(en) < 1e-3 * m ? GRAY : en > 0 ? COLORS.pos : COLORS.neg;
      const s = e.toScreen(px, py), len = Math.min(34, 10 + 14 * Math.log10(1 + m / 5));
      arrow(ctx, s.x, s.y, s.x + (f.ex / m) * len, s.y - (f.ey / m) * len, { color, width: 2.5, head: 9 });
    }

    // asa para cambiar el radio
    const hx = C.x + Rpx * Math.cos(-Math.PI / 4), hy = C.y + Rpx * Math.sin(-Math.PI / 4);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, Math.PI * 2); ctx.fill();

    // cargas
    charges.forEach((c, i) => {
      const s = e.toScreen(c.x, c.y);
      if (i === selected) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX + 7, 0, Math.PI * 2); ctx.stroke(); }
      if (c.q === 0) { ctx.fillStyle = '#5b6488'; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX, 0, Math.PI * 2); ctx.fill(); }
      else chargeDot(ctx, s.x, s.y, c.q, R_PX);
    });

    updateReadout();
  },
});

// ---------- Panel ----------
function updateReadout() {
  const totalAbs = charges.reduce((s, c) => s + Math.abs(c.q), 0) * NC / EPS0;
  const numZero = Math.abs(res.phiN) < 0.005 * totalAbs;
  $('qenc').textContent = `${fmt(res.qenc)} nC`;
  $('nin').textContent = `${res.inside.length} de ${charges.length}`;
  $('phiT').textContent = `${fmt(res.phiT)} N·m²/C`;
  $('phiN').textContent = numZero ? '≈ 0 N·m²/C' : `${fmt(res.phiN)} N·m²/C`;
  $('warn').hidden = !res.near;

  const lista = res.inside.length ? res.inside.map((c) => `${c.q > 0 ? '+' : ''}${c.q}`).join(' ') : '(ninguna)';
  $('formula').textContent =
    `Φ = Q_enc / ε₀\n` +
    `Q_enc = ${lista} = ${fmt(res.qenc)} nC\n` +
    `Φ = (${fmt(res.qenc * NC)}) / (${fmt(EPS0)})\n` +
    `  = ${fmt(res.phiT)} N·m²/C`;
}

function syncControls() {
  const c = charges[selected];
  $('qsel').disabled = !c; $('del').disabled = !c;
  if (c) { $('qsel').value = c.q; $('qselv').textContent = `${c.q > 0 ? '+' : ''}${c.q} nC`; $('qlabel').textContent = `Carga seleccionada (q${selected + 1})`; }
  else { $('qselv').textContent = '–'; $('qlabel').textContent = 'Carga seleccionada'; }
  $('rad').value = surf.R; $('radv').textContent = `${fmt(surf.R)} m`;
}

function addCharge(sign) {
  if (charges.length >= MAX_CHARGES) return;
  const [x, y] = SPOTS.find(([sx, sy]) => charges.every((c) => Math.hypot(c.x - sx, c.y - sy) > 0.3)) ?? [0, 0];
  charges.push({ x, y, q: 2 * sign }); selected = charges.length - 1; dirty = true; syncControls();
}
function load(list, resetSurf = true) {
  charges = list; selected = 0; dirty = true;
  if (resetSurf) surf = { x: 0, y: 0, R: 0.6 };
  syncControls();
}

$('qsel').addEventListener('input', () => { if (charges[selected]) { charges[selected].q = parseFloat($('qsel').value); dirty = true; syncControls(); } });
$('rad').addEventListener('input', () => { surf.R = parseFloat($('rad').value); dirty = true; syncControls(); });
$('addPos').addEventListener('click', () => addCharge(1));
$('addNeg').addEventListener('click', () => addCharge(-1));
$('del').addEventListener('click', () => { charges.splice(selected, 1); selected = Math.max(0, Math.min(selected, charges.length - 1)); dirty = true; syncControls(); });
$('clear').addEventListener('click', () => load([], false));
$('pAdentro').addEventListener('click', () => load(PRESETS.adentro()));
$('pMixto').addEventListener('click', () => load(PRESETS.mixto()));
$('pDipolo').addEventListener('click', () => load(PRESETS.dipolo()));
$('exercise').addEventListener('click', () => load([{ x: 0, y: 0, q: 5 }]));

syncControls();
sim.start();
})();
