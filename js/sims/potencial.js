(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { chargeDot, label } = CA;
const { potentialAt, potentialOf } = CA;
const { contourSegments } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const R_PX = 14, CELL = 6;
const B_COLOR = '#86efac';

// Escenas: cargas + posición de los puntos A y B
const SCENES = {
  una:     () => ({ charges: [{ x: 0, y: 0, q: 4 }], A: { x: 0.2, y: 0 }, B: { x: 0.6, y: 0 } }),
  dipolo:  () => ({ charges: [{ x: -0.7, y: 0, q: 3 }, { x: 0.7, y: 0, q: -3 }], A: { x: 0, y: 0.5 }, B: { x: 0, y: -0.5 } }),
  iguales: () => ({ charges: [{ x: -0.7, y: 0, q: 3 }, { x: 0.7, y: 0, q: 3 }], A: { x: 0, y: 0.6 }, B: { x: 0, y: 0 } }),
};

let { charges, A, B } = SCENES.una();
let selected = 0, dirty = true, drag = null, grid = null;
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

    // puntos A y B + línea entre ellos (el potencial es escalar: no se dibujan flechas)
    const SA = e.toScreen(A.x, A.y), SB = e.toScreen(B.x, B.y);
    ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(SA.x, SA.y); ctx.lineTo(SB.x, SB.y); ctx.stroke(); ctx.setLineDash([]);
    [[SA, '#fff', 'A'], [SB, B_COLOR, 'B']].forEach(([s, c, t]) => {
      ctx.fillStyle = c; ctx.strokeStyle = '#0e1226'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      label(ctx, t, s.x, s.y + 1, { color: '#0e1226', size: 12 });
    });
    const leyenda = 'rojo: V > 0 · azul: V < 0 · línea blanca punteada: V = 0';
    ctx.font = '600 11px system-ui'; const tw = ctx.measureText(leyenda).width + 24;
    ctx.fillStyle = 'rgba(14,18,38,.82)'; ctx.fillRect(e.w / 2 - tw / 2, e.h - 28, tw, 20);   // fondo para que las líneas no tapen el texto
    label(ctx, leyenda, e.w / 2, e.h - 18, { color: '#c3cbef', size: 11 });
    updateReadout();
  },
});

// ---------- Panel ----------
function updateReadout() {
  const VA = potentialAt(charges, A.x, A.y), VB = potentialAt(charges, B.x, B.y), dV = VB - VA;
  const sg = (q) => `${q > 0 ? '+' : ''}${q} nC`;
  $('vA').textContent = `${fmt(zero(VA))} V`; $('vB').textContent = `${fmt(zero(VB))} V`; $('dV').textContent = `${fmt(zero(dV))} V`;

  const rowsAt = (P) => charges.filter((c) => c.q !== 0).map((c) => { const o = potentialOf(c, P.x, P.y); return `  q${charges.indexOf(c) + 1} (${sg(c.q)}) a ${fmt(o.r)} m → ${fmt(o.v)} V`; }).join('\n') || '  (sin carga)';
  $('formula').textContent =
    `V = Σ k·qᵢ / rᵢ\n(V = 0 en el infinito)\n\nEn A:\n${rowsAt(A)}\n  V_A = ${fmt(zero(VA))} V\n\n` +
    `En B:\n${rowsAt(B)}\n  V_B = ${fmt(zero(VB))} V\n\n` +
    `ΔV = V_B − V_A = ${fmt(zero(dV))} V`;
}
const zero = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function syncControls() {
  const c = charges[selected];
  $('qsel').disabled = !c;
  if (c) { $('qsel').value = c.q; $('qselv').textContent = `${c.q > 0 ? '+' : ''}${c.q} nC`; $('qlabel').textContent = charges.length > 1 ? `Carga seleccionada (q${selected + 1})` : 'Carga fuente (q)'; }
  else { $('qselv').textContent = '–'; $('qlabel').textContent = 'Carga fuente'; }
}
function loadScene(name) { ({ charges, A, B } = SCENES[name]()); selected = 0; dirty = true; syncControls(); }

$('qsel').addEventListener('input', () => { if (charges[selected]) { charges[selected].q = parseFloat($('qsel').value); dirty = true; syncControls(); } });
$('pUna').addEventListener('click', () => loadScene('una'));
$('pDipolo').addEventListener('click', () => loadScene('dipolo'));
$('pIguales').addEventListener('click', () => loadScene('iguales'));
$('showHeat').addEventListener('change', (ev) => { show.heat = ev.target.checked; });
$('showLines').addEventListener('change', (ev) => { show.lines = ev.target.checked; });
$('exercise').addEventListener('click', () => loadScene('una'));
syncControls();
sim.start();
})();
