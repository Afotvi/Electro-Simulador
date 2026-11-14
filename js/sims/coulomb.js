(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { drawGrid, arrow, chargeDot, label } = CA;
const { K } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const UC = 1e-6;            // 1 µC en culombios
const R_PX = 18;            // radio visual de la carga
const charges = [
  { x: -0.8, y: 0, q: 3 },  // q en µC
  { x: 0.8, y: 0, q: -5 },
];

// ----- Física: fuerza neta sobre cada carga (superposición) -----
// f > 0 (mismo signo) apunta alejándose de la otra carga => repulsión
function netForces() {
  return charges.map((a, i) => {
    let fx = 0, fy = 0;
    charges.forEach((b, j) => {
      if (i === j) return;
      const dx = a.x - b.x, dy = a.y - b.y;
      const r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      if (r < 1e-3) return;
      const f = (K * a.q * UC * b.q * UC) / r2;
      fx += (f * dx) / r; fy += (f * dy) / r;
    });
    return { fx, fy };
  });
}

// ----- Interacción: arrastrar cargas -----
let drag = null;
const sim = new SimCanvas(document.getElementById('stage'), {
  scale: 250,
  onDown(p, e) {
    drag = charges.find((c) => { const s = e.toScreen(c.x, c.y); return Math.hypot(s.x - p.sx, s.y - p.sy) < R_PX * 1.6; }) ?? null;
    if (drag) e.canvas.style.cursor = 'grabbing';
  },
  onMove(p, e) {
    if (drag) {
      const b = e.bounds;
      drag.x = Math.min(b.xmax - 0.1, Math.max(b.xmin + 0.1, p.x));
      drag.y = Math.min(b.ymax - 0.1, Math.max(b.ymin + 0.1, p.y));
    } else {
      const over = charges.some((c) => { const s = e.toScreen(c.x, c.y); return Math.hypot(s.x - p.sx, s.y - p.sy) < R_PX * 1.6; });
      e.canvas.style.cursor = over ? 'grab' : 'default';
    }
  },
  onUp(_p, e) { drag = null; e.canvas.style.cursor = 'default'; },
  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    drawGrid(ctx, e, 0.5);

    const [a, b] = charges;
    const A = e.toScreen(a.x, a.y), B = e.toScreen(b.x, b.y);

    // línea de distancia
    ctx.setLineDash([6, 6]); ctx.strokeStyle = COLORS.textDim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke(); ctx.setLineDash([]);
    const r = Math.hypot(a.x - b.x, a.y - b.y);
    label(ctx, `r = ${fmt(r)} m`, (A.x + B.x) / 2, (A.y + B.y) / 2 - 16, { color: COLORS.textDim });

    // flechas de fuerza (longitud en escala logarítmica para que se vean fuerzas pequeñas y grandes)
    const F = netForces();
    charges.forEach((c, i) => {
      const mag = Math.hypot(F[i].fx, F[i].fy);
      if (mag === 0) return;
      const s = e.toScreen(c.x, c.y);
      const ux = F[i].fx / mag, uy = -F[i].fy / mag; // Y de pantalla va hacia abajo
      const len = 28 * Math.log10(1 + mag / 1e-3);
      const start = R_PX + 6;
      arrow(ctx, s.x + ux * start, s.y + uy * start, s.x + ux * (start + len), s.y + uy * (start + len), { color: COLORS.force, width: 3.5, head: 12 });
    });

    charges.forEach((c) => { const s = e.toScreen(c.x, c.y); chargeDot(ctx, s.x, s.y, c.q, R_PX); });
    updateReadout(r);
  },
});

// ----- Panel de control -----
const $ = (id) => document.getElementById(id);
const sliders = [$('q1'), $('q2')];

function updateReadout(r) {
  const [a, b] = charges;
  const F = (K * Math.abs(a.q * UC * b.q * UC)) / (r * r);
  $('r').textContent = `${fmt(r)} m`;
  $('f').textContent = `${fmt(F)} N`;
  $('kind').textContent = a.q * b.q === 0 ? 'Sin interacción' : a.q * b.q > 0 ? 'Repulsión (cargas iguales)' : 'Atracción (cargas opuestas)';
  $('formula').textContent =
    `F = k·|q₁q₂| / r²\n  = (${fmt(K)})(${fmt(Math.abs(a.q) * UC)})(${fmt(Math.abs(b.q) * UC)}) / (${fmt(r)})²\n  = ${fmt(F)} N`;
  $('formula').style.whiteSpace = 'pre';
}
function syncLabels() {
  charges.forEach((c, i) => { $(`q${i + 1}v`).textContent = `${c.q > 0 ? '+' : ''}${c.q} µC`; });
}
sliders.forEach((s, i) => s.addEventListener('input', () => { charges[i].q = parseFloat(s.value); syncLabels(); }));

$('exercise').addEventListener('click', () => {
  charges[0] = { x: -0.15, y: 0, q: 3 };
  charges[1] = { x: 0.15, y: 0, q: -5 };
  sliders[0].value = 3; sliders[1].value = -5; syncLabels();
});

syncLabels();
sim.start();
})();
