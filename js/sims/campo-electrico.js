(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { drawGrid, arrow, chargeDot, drawParticle } = CA;
const { fieldAt, fieldOf, traceLine } = CA;
const { COLORS } = CA;
const { fmt } = CA;
const { makeParticle, stepParticle, SLOW } = CA;

mountNavbar();

const R_PX = 14;          // radio visual de las cargas
const MAX_CHARGES = 6;
const SPOTS = [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8], [0, 1.1], [0, -1.1]];

const PRESETS = {
  una:     () => [{ x: 0, y: 0, q: 2 }],
  dipolo:  () => [{ x: -0.7, y: 0, q: 2 }, { x: 0.7, y: 0, q: -2 }],
  iguales: () => [{ x: -0.7, y: 0, q: 2 }, { x: 0.7, y: 0, q: 2 }],
};

let charges = PRESETS.dipolo();
let probe = { x: 0, y: 0.9 };
let selected = 0;
let dirty = true;          // true => hay que recalcular las líneas de campo
let lines = [];
let drag = null;           // { type: 'probe' } | { type: 'charge', c }

const $ = (id) => document.getElementById(id);
const show = { lines: true, vectors: false, flow: !window.matchMedia('(prefers-reduced-motion: reduce)').matches };
let part = null;      // carga de prueba "soltada" (se mueve por el campo)
let flowPhase = 0;    // avance de los puntitos que fluyen por las líneas

// ---------- Líneas de campo ----------
// Nacen de las cargas positivas (si no hay, de las negativas, recorridas al revés).
// El número de líneas es proporcional a |q|.
function rebuild(b) {
  lines = [];
  const pos = charges.filter((c) => c.q > 0);
  const sources = pos.length ? pos : charges.filter((c) => c.q < 0);
  const dir = pos.length ? 1 : -1;
  for (const c of sources) {
    const n = Math.max(6, Math.round(Math.abs(c.q) * 4));
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n + 0.05;
      lines.push({ dir, pts: traceLine(charges, c.x + 0.09 * Math.cos(a), c.y + 0.09 * Math.sin(a), dir, b) });
    }
  }
  dirty = false;
}

function drawLines(ctx, e) {
  ctx.lineWidth = 1.6; ctx.strokeStyle = COLORS.field; ctx.fillStyle = COLORS.field; ctx.globalAlpha = 0.9;
  for (const { pts, dir } of lines) {
    if (pts.length < 3) continue;
    ctx.beginPath();
    pts.forEach((p, i) => { const s = e.toScreen(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.stroke();
    // puntita de flecha en la mitad, apuntando en el sentido del campo
    const k = Math.floor(pts.length / 2);
    let a = e.toScreen(pts[k].x, pts[k].y), b = e.toScreen(pts[k + 1].x, pts[k + 1].y);
    if (dir < 0) [a, b] = [b, a];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.moveTo(a.x + Math.cos(ang) * 7, a.y + Math.sin(ang) * 7);
    ctx.lineTo(a.x + Math.cos(ang + 2.5) * 6, a.y + Math.sin(ang + 2.5) * 6);
    ctx.lineTo(a.x + Math.cos(ang - 2.5) * 6, a.y + Math.sin(ang - 2.5) * 6);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Flechas pequeñas en una cuadrícula: más opacas donde el campo es más fuerte.
function drawVectors(ctx, e) {
  const b = e.bounds, step = 0.4;
  for (let x = Math.ceil(b.xmin / step) * step; x < b.xmax; x += step) {
    for (let y = Math.ceil(b.ymin / step) * step; y < b.ymax; y += step) {
      if (charges.some((c) => Math.hypot(x - c.x, y - c.y) < 0.15)) continue;
      const f = fieldAt(charges, x, y), m = Math.hypot(f.ex, f.ey);
      if (m === 0) continue;
      const s = e.toScreen(x, y), ux = f.ex / m, uy = -f.ey / m;
      ctx.globalAlpha = Math.min(0.9, 0.2 + 0.25 * Math.log10(1 + m / 5));
      arrow(ctx, s.x - ux * 9, s.y - uy * 9, s.x + ux * 9, s.y + uy * 9, { color: COLORS.force, width: 1.5, head: 6 });
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- Animación: puntitos que fluyen por las líneas de campo (de + a −) ----------
const DS = 0.02, SPACE = 0.17;   // DS = paso de traceLine (m) · SPACE = separación entre puntitos (m)
function drawFlow(ctx, e) {
  ctx.fillStyle = COLORS.force;
  for (const { pts, dir } of lines) {
    const L = (pts.length - 1) * DS; if (L < SPACE) continue;
    for (let u = flowPhase % SPACE; u < L; u += SPACE) {
      const s = dir > 0 ? u : L - u;                       // las líneas trazadas "al revés" fluyen hacia su inicio
      const k = Math.min(pts.length - 2, Math.floor(s / DS)), t = s / DS - k;
      const S = e.toScreen(pts[k].x + (pts[k + 1].x - pts[k].x) * t, pts[k].y + (pts[k + 1].y - pts[k].y) * t);
      ctx.beginPath(); ctx.arc(S.x, S.y, 2.7, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function updatePart() {
  $('pv').textContent = part ? `${fmt(Math.hypot(part.vx, part.vy))} m/s` : '–';
  $('pst').textContent = part ? (part.alive ? 'en movimiento' : part.why) : '–';
}

// ---------- Interacción ----------
const near = (e, p, wx, wy, r) => { const s = e.toScreen(wx, wy); return Math.hypot(s.x - p.sx, s.y - p.sy) < r; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const sim = new SimCanvas($('stage'), {
  scale: 250,
  update(dt, e) {
    flowPhase += 0.3 * dt;                                         // los puntitos avanzan ~0,3 m/s
    if (part?.alive) stepParticle(part, charges, dt * SLOW, e.bounds);
  },
  onDown(p, e) {
    if (near(e, p, probe.x, probe.y, 18)) { drag = { type: 'probe' }; return; }
    const i = charges.findIndex((c) => near(e, p, c.x, c.y, R_PX * 1.6));
    if (i >= 0) { drag = { type: 'charge', c: charges[i] }; selected = i; syncControls(); }
  },
  onMove(p, e) {
    const b = e.bounds;
    if (drag) {
      const t = drag.type === 'probe' ? probe : drag.c;
      t.x = clamp(p.x, b.xmin + 0.1, b.xmax - 0.1);
      t.y = clamp(p.y, b.ymin + 0.1, b.ymax - 0.1);
      if (drag.type === 'charge') dirty = true;
      e.canvas.style.cursor = 'grabbing';
    } else {
      const over = near(e, p, probe.x, probe.y, 18) || charges.some((c) => near(e, p, c.x, c.y, R_PX * 1.6));
      e.canvas.style.cursor = over ? 'grab' : 'default';
    }
  },
  onUp(_p, e) { drag = null; e.canvas.style.cursor = 'default'; },

  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    drawGrid(ctx, e, 0.5);
    if (dirty) rebuild(e.bounds);
    if (show.vectors) drawVectors(ctx, e);
    if (show.lines) drawLines(ctx, e);
    if (show.flow && show.lines) drawFlow(ctx, e);

    // cargas (la seleccionada lleva un aro)
    charges.forEach((c, i) => {
      const s = e.toScreen(c.x, c.y);
      if (i === selected) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX + 7, 0, Math.PI * 2); ctx.stroke(); }
      if (c.q === 0) { ctx.fillStyle = '#5b6488'; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX, 0, Math.PI * 2); ctx.fill(); }
      else chargeDot(ctx, s.x, s.y, c.q, R_PX);
    });

    drawParticle(ctx, e, part);

    // carga de prueba + vector del campo total en ese punto
    const f = fieldAt(charges, probe.x, probe.y), m = Math.hypot(f.ex, f.ey);
    const P = e.toScreen(probe.x, probe.y);
    if (m > 0) {
      const len = Math.min(150, 45 * Math.log10(1 + m / 5));
      arrow(ctx, P.x, P.y, P.x + (f.ex / m) * len, P.y - (f.ey / m) * len, { color: COLORS.force, width: 3.5, head: 12 });
    }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath(); ctx.arc(P.x, P.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    updateReadout(); updatePart();
  },
});

// ---------- Panel ----------
function updateReadout() {
  const f = fieldAt(charges, probe.x, probe.y), m = Math.hypot(f.ex, f.ey);
  const ang = (Math.atan2(f.ey, f.ex) * 180) / Math.PI;
  $('emag').textContent = `${fmt(m)} N/C`;
  $('eang').textContent = m === 0 ? '–' : `${fmt(ang, 3)}°`;
  const rows = charges.map((c, i) => {
    const o = fieldOf(c, probe.x, probe.y);
    return c.q === 0 ? null : `E${i + 1}: r = ${fmt(o.r)} m → ${fmt(o.e)} N/C (${c.q > 0 ? 'se aleja' : 'se acerca'})`;
  }).filter(Boolean);
  $('formula').textContent =
    `E = k·|q| / r²   (cada carga)\n${rows.join('\n') || '(sin cargas)'}\n\nSuma vectorial:\nEx = ${fmt(f.ex)}  Ey = ${fmt(f.ey)}\n|E| = ${fmt(m)} N/C`;
}

function syncControls() {
  const c = charges[selected];
  $('qsel').disabled = !c;
  $('del').disabled = !c;
  if (c) { $('qsel').value = c.q; $('qselv').textContent = `${c.q > 0 ? '+' : ''}${c.q} nC`; $('qlabel').textContent = `Carga seleccionada (q${selected + 1})`; }
  else { $('qselv').textContent = '–'; $('qlabel').textContent = 'Carga seleccionada'; }
}

function addCharge(sign) {
  if (charges.length >= MAX_CHARGES) return;
  const [x, y] = SPOTS.find(([sx, sy]) => charges.every((c) => Math.hypot(c.x - sx, c.y - sy) > 0.3)) ?? [0, 0];
  charges.push({ x, y, q: 2 * sign });
  selected = charges.length - 1; dirty = true; syncControls();
}
function load(list) { charges = list; selected = 0; dirty = true; syncControls(); }

$('qsel').addEventListener('input', () => { if (charges[selected]) { charges[selected].q = parseFloat($('qsel').value); dirty = true; syncControls(); } });
$('addPos').addEventListener('click', () => addCharge(1));
$('addNeg').addEventListener('click', () => addCharge(-1));
$('del').addEventListener('click', () => { charges.splice(selected, 1); selected = Math.max(0, Math.min(selected, charges.length - 1)); dirty = true; syncControls(); });
$('clear').addEventListener('click', () => load([]));
$('pUna').addEventListener('click', () => load(PRESETS.una()));
$('pDipolo').addEventListener('click', () => load(PRESETS.dipolo()));
$('pIguales').addEventListener('click', () => load(PRESETS.iguales()));
$('showLines').addEventListener('change', (ev) => { show.lines = ev.target.checked; });
$('showVec').addEventListener('change', (ev) => { show.vectors = ev.target.checked; });
$('showFlow').checked = show.flow;
$('showFlow').addEventListener('change', (ev) => { show.flow = ev.target.checked; });
$('pPos').addEventListener('click', () => { part = makeParticle(probe.x, probe.y, 1); });
$('pNeg').addEventListener('click', () => { part = makeParticle(probe.x, probe.y, -1); });
$('pStop').addEventListener('click', () => { part = null; });
$('exercise').addEventListener('click', () => { load([{ x: 0, y: 0, q: 2 }]); probe = { x: 0.5, y: 0 }; });

syncControls();
sim.start();
})();
