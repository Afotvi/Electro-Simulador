(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { COLORS } = CA;
// Utilidades de dibujo compartidas por todas las simulaciones.

function drawGrid(ctx, e, step = 0.5) {
  const { xmin, xmax, ymin, ymax } = e.bounds;
  ctx.lineWidth = 1;
  for (let x = Math.ceil(xmin / step) * step; x <= xmax; x += step) {
    const s = e.toScreen(x, 0).x;
    ctx.strokeStyle = Math.abs(x) < 1e-9 ? COLORS.gridStrong : COLORS.grid;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, e.h); ctx.stroke();
  }
  for (let y = Math.ceil(ymin / step) * step; y <= ymax; y += step) {
    const s = e.toScreen(0, y).y;
    ctx.strokeStyle = Math.abs(y) < 1e-9 ? COLORS.gridStrong : COLORS.grid;
    ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(e.w, s); ctx.stroke();
  }
}

// Flecha en coordenadas de PANTALLA.
function arrow(ctx, x1, y1, x2, y2, { color = '#fff', width = 3, head = 10 } = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath(); ctx.fill();
}

// Carga puntual con halo brillante. `sign` = +1 / -1.
function chargeDot(ctx, x, y, sign, radius = 18, glow = true) {
  const color = sign >= 0 ? COLORS.pos : COLORS.neg;
  if (glow) {
    const g = ctx.createRadialGradient(x, y, radius * 0.4, x, y, radius * 2.6);
    g.addColorStop(0, color + '66'); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, radius * 2.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e1226'; ctx.font = `700 ${radius * 1.2}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(sign >= 0 ? '+' : '−', x, y + 1);
}

function label(ctx, text, x, y, { color = COLORS.text, size = 13, align = 'center' } = {}) {
  ctx.fillStyle = color; ctx.font = `600 ${size}px system-ui`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y);
}

// Partícula con estela que se desvanece. p = { x, y, q, alive, trail:[{x,y}] }
function drawParticle(ctx, e, p) {
  if (!p) return;
  const col = p.q >= 0 ? COLORS.pos : COLORS.neg, n = p.trail.length;
  ctx.lineCap = 'round';
  for (let i = 1; i < n; i++) {
    const a = e.toScreen(p.trail[i - 1].x, p.trail[i - 1].y), b = e.toScreen(p.trail[i].x, p.trail[i].y);
    ctx.globalAlpha = (i / n) * 0.85; ctx.strokeStyle = col; ctx.lineWidth = 1.5 + 3.5 * (i / n);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (p.alive) {
    const s = e.toScreen(p.x, p.y);
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}
Object.assign(CA, { drawGrid, arrow, chargeDot, label, drawParticle });
})();
