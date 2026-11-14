(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { EPS0 } = CA;
// Capacitores (módulo puro, sin DOM).

// Constantes dieléctricas típicas (valores de libro de texto; pueden variar un poco según el libro)
const DIELECTRICS = [
  { id: 'aire',   name: 'Aire / vacío',  kappa: 1,   color: null },
  { id: 'teflon', name: 'Teflón',        kappa: 2.1, color: '#a3b1c6' },
  { id: 'papel',  name: 'Papel',         kappa: 3.7, color: '#e2c89a' },
  { id: 'vidrio', name: 'Vidrio Pyrex',  kappa: 5.6, color: '#9fd8e8' },
  { id: 'agua',   name: 'Agua',          kappa: 80,  color: '#4aa3ff' },
];

// Capacitor de placas paralelas con un dieléctrico insertado una fracción x (0..1) del ancho de las placas.
//   C = ε₀·A/d · [1 + (κ − 1)·x]     (la parte con dieléctrico y la parte con aire quedan en paralelo)
// Batería conectada:    V es fija      →  Q = C·V
// Batería desconectada: Q es fija      →  V = Q / C
// A en cm², d en mm, V en voltios, Q en culombios.
function plateCapacitor({ A_cm2, d_mm, kappa, x, V, Q, connected }) {
  const A = A_cm2 * 1e-4, d = d_mm * 1e-3;
  const C0 = (EPS0 * A) / d;
  const C = C0 * (1 + (kappa - 1) * x);
  const Vf = connected ? V : Q / C;
  const Qf = connected ? C * V : Q;
  return { A, d, C0, C, V: Vf, Q: Qf, E: Vf / d, U: 0.5 * C * Vf * Vf };
}

// Tres capacitores (C en faradios):
//   serie:     C1 — C2 — C3        (misma Q)
//   paralelo:  C1 ∥ C2 ∥ C3        (mismo V)
//   combinado: C1 en serie con (C2 ∥ C3)
function solveCaps(mode, V, C) {
  const items = [0, 1, 2].map(() => ({ Q: 0, V: 0, U: 0 }));
  let Ceq, C23 = null, V23 = null;
  if (mode === 'serie') {
    Ceq = 1 / (1 / C[0] + 1 / C[1] + 1 / C[2]);
    const Q = Ceq * V; items.forEach((it, i) => { it.Q = Q; it.V = Q / C[i]; });
  } else if (mode === 'paralelo') {
    Ceq = C[0] + C[1] + C[2];
    items.forEach((it, i) => { it.V = V; it.Q = C[i] * V; });
  } else {
    C23 = C[1] + C[2];
    Ceq = (C[0] * C23) / (C[0] + C23);
    const Q = Ceq * V; V23 = Q / C23;
    items[0].Q = Q; items[0].V = Q / C[0];
    [1, 2].forEach((i) => { items[i].V = V23; items[i].Q = C[i] * V23; });
  }
  items.forEach((it, i) => { it.U = 0.5 * C[i] * it.V * it.V; });
  const Qtot = Ceq * V;
  return { Ceq, Q: Qtot, U: 0.5 * Ceq * V * V, items, C23, V23 };
}
Object.assign(CA, { DIELECTRICS, plateCapacitor, solveCaps });
})();
