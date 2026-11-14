(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { K } = CA;
// Física del campo eléctrico (módulo puro, sin DOM): lo reutilizan Campo eléctrico, Gauss y Potencial.
// Cada carga es { x, y, q } con x,y en metros y q en nC.

const NC = 1e-9;

// Campo eléctrico total en (x, y): superposición E = Σ k·qᵢ/rᵢ² · r̂ᵢ   (devuelve N/C)
function fieldAt(charges, x, y) {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy;
    if (r2 < 1e-6) continue;           // evita dividir por ~0 encima de una carga
    const r = Math.sqrt(r2);
    const e = (K * c.q * NC) / r2;
    ex += (e * dx) / r; ey += (e * dy) / r;
  }
  return { ex, ey };
}

// Aporte de UNA carga al punto (x, y): útil para mostrar el desglose paso a paso.
function fieldOf(c, x, y) {
  const dx = x - c.x, dy = y - c.y, r = Math.hypot(dx, dy);
  if (r < 1e-3) return { r, e: 0, ex: 0, ey: 0 };
  const e = (K * Math.abs(c.q) * NC) / (r * r);
  const s = Math.sign(c.q);
  return { r, e, ex: (s * e * dx) / r, ey: (s * e * dy) / r };
}

// Sigue una línea de campo con pasos de longitud fija (método del punto medio).
// dir = +1 sigue el campo (sale de las positivas), dir = -1 va en contra.
function traceLine(charges, x, y, dir, b, { ds = 0.02, maxSteps = 2000, capture = 0.07 } = {}) {
  const pts = [{ x, y }];
  for (let i = 0; i < maxSteps; i++) {
    let f = fieldAt(charges, x, y), m = Math.hypot(f.ex, f.ey);
    if (m === 0) break;
    const mx = x + (dir * ds / 2) * f.ex / m, my = y + (dir * ds / 2) * f.ey / m;
    f = fieldAt(charges, mx, my); m = Math.hypot(f.ex, f.ey);
    if (m === 0) break;
    x += dir * ds * f.ex / m; y += dir * ds * f.ey / m;
    pts.push({ x, y });
    if (x < b.xmin - 0.2 || x > b.xmax + 0.2 || y < b.ymin - 0.2 || y > b.ymax + 0.2) break;
    if (charges.some((c) => Math.hypot(x - c.x, y - c.y) < capture)) break; // llegó a una carga
  }
  return pts;
}

// Flujo ∮E·dA a través de una esfera de radio R centrada en (cx, cy, 0), calculado NUMÉRICAMENTE
// (suma de E·n̂ por cada trocito de superficie). Las cargas están en el plano z = 0.
// Sirve para comprobar la ley de Gauss: el resultado debe ser Q_enc / ε₀. Devuelve N·m²/C.
function fluxThroughSphere(charges, cx, cy, R, nT = 90, nP = 180) {
  const dT = Math.PI / nT, dP = (2 * Math.PI) / nP;
  let flux = 0;
  for (let i = 0; i < nT; i++) {
    const th = (i + 0.5) * dT, st = Math.sin(th), ct = Math.cos(th);
    for (let j = 0; j < nP; j++) {
      const ph = (j + 0.5) * dP;
      const nx = st * Math.cos(ph), ny = st * Math.sin(ph), nz = ct;     // normal saliente
      const x = cx + R * nx, y = cy + R * ny, z = R * nz;
      let en = 0;
      for (const c of charges) {
        const dx = x - c.x, dy = y - c.y, dz = z;
        const r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2);
        en += ((K * c.q * NC) / r2) * ((dx * nx + dy * ny + dz * nz) / r); // componente normal de E
      }
      flux += en * R * R * st * dT * dP;                                   // dA = R² sinθ dθ dφ
    }
  }
  return flux;
}

// Potencial eléctrico total en (x, y): V = Σ k·qᵢ / rᵢ  (V = 0 en el infinito). Devuelve voltios.
function potentialAt(charges, x, y) {
  let v = 0;
  for (const c of charges) {
    const r = Math.max(Math.hypot(x - c.x, y - c.y), 0.01);   // evita el infinito encima de una carga
    v += (K * c.q * NC) / r;
  }
  return v;
}

// Aporte de UNA carga al potencial en (x, y), con su distancia (para el desglose paso a paso).
function potentialOf(c, x, y) {
  const r = Math.max(Math.hypot(x - c.x, y - c.y), 0.01);
  return { r, v: (K * c.q * NC) / r };
}
Object.assign(CA, { fieldAt, fieldOf, traceLine, fluxThroughSphere, potentialAt, potentialOf });
})();
