(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { arrow, chargeDot, label, drawParticle } = CA;
const { fieldAt, potentialAt, potentialOf } = CA;
const { contourSegments } = CA;
const { makeParticle, stepParticle, kineticNJ, potentialNJ, SLOW } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R_PX = 14, MAX_CHARGES = 6, CELL = 6;
const SPOTS = [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8], [0, 1.1], [0, -1.1]];
const B_COLOR = '#86efac';

// Escenas: cargas + posición de los puntos A y B
const SCENES = {
  una:     () => ({ charges: [{ x: 0, y: 0, q: 4 }], A: { x: 0.2, y: 0 }, B: { x: 0.6, y: 0 } }),
  dipolo:  () => ({ charges: [{ x: -0.7, y: 0, q: 3 }, { x: 0.7, y: 0, q: -3 }], A: { x: 0, y: 0.5 }, B: { x: 0, y: -0.5 } }),
  iguales: () => ({ charges: [{ x: -0.7, y: 0, q: 3 }, { x: 0.7, y: 0, q: 3 }], A: { x: 0, y: 0.6 }, B: { x: 0, y: 0 } }),
};

let { charges, A, B } = SCENES.dipolo();
let q0 = 1;                         // carga de prueba (nC)
let selected = 0, dirty = true, drag = null, grid = null;
let part = null, eMax = 1e-9;      // carga soltada desde A y escala de las barras de energía
const show = { heat: true, lines: true };

// Niveles de las equipotenciales: 0 y ±2,5; 5; 10; 20 … 1280 V (escala geométrica)
const LEVELS = (() => { const g = [2.5, 5, 10, 20, 40, 80, 160, 320, 640, 1280]; return [0, ...g, ...g.map((x) => -x)]; })();

// ---------- Mapa de potencial + equipotenciales (se recalcula solo al cambiar algo) ----------
function buildGrid(e) {
  const nx = Math.ceil(e.w / CELL), ny = Math.ceil(e.h / CELL), W = nx + 1;
  const vals = new Float32Array(W * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    vals[j * W + i] = potentialAt(charges, (i * CELL - e.ox) / e.scale, (e.oy - j * CELL) / e.scale);
  }
  const off = grid?.img ?? document.createElement('canvas');
  off.width = W; off.height = ny + 1;
  const octx = off.getContext('2d'), id = octx.createImageData(W, ny + 1);
  for (let k = 0; k < vals.length; k++) {
    const V = vals[k], t = clamp(Math.sign(V) * Math.log10(1 + Math.abs(V) / 8) / 2.6, -1, 1), s = Math.pow(Math.abs(t), 0.8) * 0.85;
    const tgt = t >= 0 ? [255, 90, 78] : [56, 189, 248];
    id.data[4 * k] = 14 + (tgt[0] - 14) * s; id.data[4 * k + 1] = 18 + (tgt[1] - 18) * s; id.data[4 * k + 2] = 38 + (tgt[2] - 38) * s; id.data[4 * k + 3] = 255;
  }
  octx.putImageData(id, 0, 0);
  const paths = LEVELS.map((level) => {
    const p = new Path2D();
    for (const s of contourSegments(vals, nx, ny, level)) { p.moveTo(s[0] * CELL, s[1] * CELL); p.lineTo(s[2] * CELL, s[3] * CELL); }
    return { level, path: p };
  });
  grid = { nx, ny, w: e.w, h: e.h, img: off, paths };
  dirty = false;
}

// ---------- Interacción ----------
const near = (e, p, wx, wy, r) => { const s = e.toScreen(wx, wy); return Math.hypot(s.x - p.sx, s.y - p.sy) < r; };

const sim = new SimCanvas($('stage'), {
  scale: 250,
  update(dt, e) { if (part?.alive) stepParticle(part, charges, dt * SLOW, e.bounds); },
  onDown(p, e) {
    if (near(e, p, A.x, A.y, 18)) { drag = { t: A, probe: true }; return; }
    if (near(e, p, B.x, B.y, 18)) { drag = { t: B, probe: true }; return; }
    const i = charges.findIndex((c) => near(e, p, c.x, c.y, R_PX * 1.6));
    if (i >= 0) { drag = { t: charges[i] }; selected = i; syncControls(); }
  },
  onMove(p, e) {
    const b = e.bounds;
    if (drag) {
      drag.t.x = clamp(p.x, b.xmin + 0.1, b.xmax - 0.1); drag.t.y = clamp(p.y, b.ymin + 0.1, b.ymax - 0.1);
      if (!drag.probe) dirty = true;
      e.canvas.style.cursor = 'grabbing';
    } else {
      const over = near(e, p, A.x, A.y, 18) || near(e, p, B.x, B.y, 18) || charges.some((c) => near(e, p, c.x, c.y, R_PX * 1.6));
      e.canvas.style.cursor = over ? 'grab' : 'default';
    }
  },
  onUp(_p, e) { drag = null; e.canvas.style.cursor = 'default'; },

  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    if (dirty || !grid || grid.w !== e.w || grid.h !== e.h) buildGrid(e);

    if (show.heat) { ctx.imageSmoothingEnabled = true; ctx.drawImage(grid.img, -CELL / 2, -CELL / 2, (grid.nx + 1) * CELL, (grid.ny + 1) * CELL); }
    if (show.lines) {
      for (const { level, path } of grid.paths) {
        ctx.strokeStyle = level > 0 ? 'rgba(255,190,170,.85)' : level < 0 ? 'rgba(160,225,255,.85)' : 'rgba(255,255,255,.95)';
        ctx.lineWidth = level === 0 ? 2.2 : 1.2; ctx.setLineDash(level === 0 ? [7, 5] : []); ctx.stroke(path);
      }
      ctx.setLineDash([]);
    }

    // cargas
    charges.forEach((c, i) => {
      const s = e.toScreen(c.x, c.y);
      if (i === selected) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX + 7, 0, Math.PI * 2); ctx.stroke(); }
      if (c.q === 0) { ctx.fillStyle = '#5b6488'; ctx.beginPath(); ctx.arc(s.x, s.y, R_PX, 0, Math.PI * 2); ctx.fill(); }
      else chargeDot(ctx, s.x, s.y, c.q, R_PX, false);
    });

    drawParticle(ctx, e, part);

    // puntos A y B + línea entre ellos + vector E en A (siempre perpendicular a la equipotencial)
    const SA = e.toScreen(A.x, A.y), SB = e.toScreen(B.x, B.y);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(SA.x, SA.y); ctx.lineTo(SB.x, SB.y); ctx.stroke(); ctx.setLineDash([]);
    const f = fieldAt(charges, A.x, A.y), m = Math.hypot(f.ex, f.ey);
    if (m > 0) {
      const len = Math.min(80, 28 * Math.log10(1 + m / 5));
      arrow(ctx, SA.x, SA.y, SA.x + (f.ex / m) * len, SA.y - (f.ey / m) * len, { color: COLORS.force, width: 3.5, head: 12 });
    }
    [[SA, '#fff', 'A'], [SB, B_COLOR, 'B']].forEach(([s, c, t]) => {
      ctx.fillStyle = c; ctx.strokeStyle = '#0e1226'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      label(ctx, t, s.x, s.y + 1, { color: '#0e1226', size: 12 });
    });
    drawEnergy(ctx);
    const leyenda = 'rojo: V > 0 · azul: V < 0 · línea blanca punteada: V = 0 · flecha amarilla: E en A';
    ctx.font = '600 11px system-ui'; const tw = ctx.measureText(leyenda).width + 24;
    ctx.fillStyle = 'rgba(14,18,38,.82)'; ctx.fillRect(e.w / 2 - tw / 2, e.h - 28, tw, 20);   // fondo para que las líneas no tapen el texto
    label(ctx, leyenda, e.w / 2, e.h - 18, { color: '#c3cbef', size: 11 });
    updateReadout(); updateEnergy();
  },
});

// ---------- Animación: soltar q₀ desde A y ver cómo U se convierte en K ----------
const REL_DEFAULT = 'La carga parte del reposo en A. Mira cómo la energía potencial U se convierte en cinética K, y cómo U + K no cambia (cámara lenta 0,6×).';
const energies = () => { const U = potentialNJ(part, charges), K = kineticNJ(part); return { U, K, T: U + K }; };

function drawEnergy(ctx) {
  if (!part) return;
  const { U, K, T } = energies();
  eMax = Math.max(eMax, Math.abs(U), K, Math.abs(T));
  const x = 14, y = 14, w = 240, h = 92, mid = x + 95, half = 64;
  ctx.fillStyle = 'rgba(14,18,38,.82)'; ctx.fillRect(x, y, w, h);
  label(ctx, 'Energía (nJ)', x + 10, y + 12, { align: 'left', size: 11, color: COLORS.textDim });
  [['U', U, '#a78bfa'], ['K', K, COLORS.force], ['U+K', T, '#ffffff']].forEach(([n, v, c], i) => {
    const by = y + 34 + i * 22, bw = (v / eMax) * half;
    label(ctx, n, x + 8, by, { align: 'left', size: 11 });
    ctx.fillStyle = c; ctx.fillRect(Math.min(mid, mid + bw), by - 6, Math.abs(bw), 12);
    label(ctx, fmt(Math.abs(v) < 1e-6 * eMax ? 0 : v), x + w - 8, by, { align: 'right', size: 11 });   // ruido numérico → 0
  });
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mid, y + 22); ctx.lineTo(mid, y + h - 6); ctx.stroke();
}

function updateEnergy() {
  if (!part) { $('eU').textContent = $('eK').textContent = $('eT').textContent = '–'; $('relMsg').textContent = REL_DEFAULT; return; }
  const { U, K, T } = energies();
  const z = (v) => (Math.abs(v) < 1e-6 * eMax ? 0 : v);   // ruido numérico → 0
  $('eU').textContent = `${fmt(z(U))} nJ`; $('eK').textContent = `${fmt(z(K))} nJ`; $('eT').textContent = `${fmt(z(T))} nJ`;
  $('relMsg').textContent = part.alive ? 'En movimiento (cámara lenta 0,6×). Cuando U baja, K sube.' : `Terminó: ${part.why}. Hasta ahí, U + K se mantuvo constante.`;
}

// ---------- Panel ----------
function updateReadout() {
  const VA = potentialAt(charges, A.x, A.y), VB = potentialAt(charges, B.x, B.y), dV = VB - VA;
  const dU = q0 * dV, W = -dU;                    // nC·V = nJ
  const f = fieldAt(charges, A.x, A.y);
  const sg = (q) => `${q > 0 ? '+' : ''}${q} nC`;
  $('vA').textContent = `${fmt(VA)} V`; $('vB').textContent = `${fmt(VB)} V`; $('dV').textContent = `${fmt(dV)} V`;
  $('W').textContent = `${fmt(zero(W))} nJ`; $('dU').textContent = `${fmt(zero(dU))} nJ`; $('eA').textContent = `${fmt(Math.hypot(f.ex, f.ey))} N/C`;

  const rows = charges.filter((c) => c.q !== 0).map((c, i) => { const o = potentialOf(c, A.x, A.y); return `  q${charges.indexOf(c) + 1} (${sg(c.q)}) a ${fmt(o.r)} m → ${fmt(o.v)} V`; });
  $('formula').textContent =
    `V = Σ k·qᵢ / rᵢ     (V = 0 en el infinito)\nEn A:\n${rows.join('\n') || '  (sin cargas)'}\n  V_A = ${fmt(VA)} V\n` +
    `En B:  V_B = ${fmt(VB)} V\n\nΔV = V_B − V_A = ${fmt(dV)} V\n` +
    `q₀ = ${sg(q0)}\nΔU = q₀·ΔV = ${fmt(zero(dU))} nJ\nW_campo (A→B) = −ΔU = ${fmt(zero(W))} nJ`;
}
const zero = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function syncControls() {
  const c = charges[selected];
  $('qsel').disabled = !c; $('del').disabled = !c;
  if (c) { $('qsel').value = c.q; $('qselv').textContent = `${c.q > 0 ? '+' : ''}${c.q} nC`; $('qlabel').textContent = `Carga seleccionada (q${selected + 1})`; }
  else { $('qselv').textContent = '–'; $('qlabel').textContent = 'Carga seleccionada'; }
  $('q0').value = q0; $('q0v').textContent = `${q0 > 0 ? '+' : ''}${q0} nC`;
}
function addCharge(sign) {
  if (charges.length >= MAX_CHARGES) return;
  const [x, y] = SPOTS.find(([sx, sy]) => charges.every((c) => Math.hypot(c.x - sx, c.y - sy) > 0.3)) ?? [0, 0];
  charges.push({ x, y, q: 2 * sign }); selected = charges.length - 1; dirty = true; syncControls();
}
function loadScene(name) { ({ charges, A, B } = SCENES[name]()); selected = 0; dirty = true; part = null; syncControls(); }

$('qsel').addEventListener('input', () => { if (charges[selected]) { charges[selected].q = parseFloat($('qsel').value); dirty = true; syncControls(); } });
$('q0').addEventListener('input', () => { q0 = parseFloat($('q0').value); syncControls(); });
$('addPos').addEventListener('click', () => addCharge(1));
$('addNeg').addEventListener('click', () => addCharge(-1));
$('del').addEventListener('click', () => { charges.splice(selected, 1); selected = Math.max(0, Math.min(selected, charges.length - 1)); dirty = true; syncControls(); });
$('clear').addEventListener('click', () => { charges = []; selected = 0; dirty = true; syncControls(); });
$('pUna').addEventListener('click', () => loadScene('una'));
$('pDipolo').addEventListener('click', () => loadScene('dipolo'));
$('pIguales').addEventListener('click', () => loadScene('iguales'));
$('showHeat').addEventListener('change', (ev) => { show.heat = ev.target.checked; });
$('showLines').addEventListener('change', (ev) => { show.lines = ev.target.checked; });
$('exercise').addEventListener('click', () => { loadScene('una'); q0 = 1; syncControls(); });
$('release').addEventListener('click', () => {
  if (q0 === 0) { $('relMsg').textContent = 'Con q₀ = 0 no hay fuerza: elige una carga distinta de cero.'; return; }
  part = makeParticle(A.x, A.y, q0); eMax = Math.max(Math.abs(potentialNJ(part, charges)), 1e-9);
});
$('stopP').addEventListener('click', () => { part = null; });

syncControls();
sim.start();
})();
