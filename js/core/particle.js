(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { fieldAt, potentialAt } = CA;
// Partícula cargada que se mueve bajo el campo de las cargas fijas (módulo puro, sin DOM).
// Física real en SI: a = q·E / m, integrada con velocity-Verlet y subpasos pequeños
// (así la energía mecánica K + U se conserva).

const MASS = 1e-8;   // kg (10 µg): con q ≈ 1 nC da aceleraciones cómodas de ver
const SLOW = 0.6;    // cámara lenta de la animación (1 = tiempo real)

// q en nC. Parte del reposo en (x, y).
const makeParticle = (x, y, q) => ({ x, y, vx: 0, vy: 0, q, alive: true, why: '', trail: [{ x, y }] });

function stepParticle(p, charges, dt, b, capture = 0.07) {
  if (!p.alive) return;
  const n = Math.max(1, Math.ceil(dt / 0.0005)), h = dt / n, k = (p.q * 1e-9) / MASS;
  let f = fieldAt(charges, p.x, p.y), ax = k * f.ex, ay = k * f.ey;
  for (let i = 0; i < n; i++) {
    p.x += p.vx * h + 0.5 * ax * h * h; p.y += p.vy * h + 0.5 * ay * h * h;
    f = fieldAt(charges, p.x, p.y);
    const bx = k * f.ex, by = k * f.ey;
    p.vx += 0.5 * (ax + bx) * h; p.vy += 0.5 * (ay + by) * h; ax = bx; ay = by;
    const hit = charges.findIndex((c) => Math.hypot(p.x - c.x, p.y - c.y) < capture);
    if (hit >= 0) { p.alive = false; p.why = `absorbida por q${hit + 1}`; break; }
    if (p.x < b.xmin - 0.2 || p.x > b.xmax + 0.2 || p.y < b.ymin - 0.2 || p.y > b.ymax + 0.2) { p.alive = false; p.why = 'salió de la pantalla'; break; }
  }
  p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 260) p.trail.shift();
}

const kineticNJ = (p) => 0.5 * MASS * (p.vx * p.vx + p.vy * p.vy) * 1e9;      // nJ
const potentialNJ = (p, charges) => p.q * potentialAt(charges, p.x, p.y);       // nC·V = nJ
Object.assign(CA, { MASS, SLOW, makeParticle, stepParticle, kineticNJ, potentialNJ });
})();
