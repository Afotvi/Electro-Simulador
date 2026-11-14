(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Cálculo de circuitos de 3 resistencias (módulo puro, sin DOM).
//   serie:     R1 — R2 — R3
//   paralelo:  R1 ∥ R2 ∥ R3
//   combinado: R1 en serie con (R2 ∥ R3)
// open[i] = true significa que la resistencia i está abierta (fundida): no pasa corriente por ella.
// Devuelve la resistencia equivalente, la corriente total y V, I, P de cada resistencia.
function solveCircuit(mode, V, R, open = [false, false, false]) {
  const items = [0, 1, 2].map(() => ({ V: 0, I: 0, P: 0 }));
  let Req = Infinity, I = 0, R23 = null, V23 = null, broken = false;

  if (mode === 'serie') {
    if (open.some(Boolean)) {
      broken = true;                                    // sin camino: I = 0, todo el voltaje cae en la abierta
      items.forEach((it, i) => { it.V = open[i] ? V : 0; });
    } else {
      Req = R[0] + R[1] + R[2]; I = V / Req;
      items.forEach((it, i) => { it.I = I; it.V = I * R[i]; });
    }
  } else if (mode === 'paralelo') {
    items.forEach((it, i) => { it.V = V; it.I = open[i] ? 0 : V / R[i]; });
    I = items.reduce((s, it) => s + it.I, 0);
    Req = I > 0 ? V / I : Infinity;
    broken = I === 0;
  } else { // combinado
    const g = (open[1] ? 0 : 1 / R[1]) + (open[2] ? 0 : 1 / R[2]);   // conductancia del bloque R2∥R3
    if (open[0]) {
      broken = true; items[0].V = V;
    } else if (g === 0) {
      broken = true; items[1].V = items[2].V = V;
    } else {
      R23 = 1 / g; Req = R[0] + R23; I = V / Req; V23 = I * R23;
      items[0].I = I; items[0].V = I * R[0];
      [1, 2].forEach((i) => { items[i].V = V23; items[i].I = open[i] ? 0 : V23 / R[i]; });
    }
  }
  items.forEach((it) => { it.P = it.V * it.I; });
  return { Req, I, items, R23, V23, broken };
}

// Circuito de 2 mallas con 2 fuentes (Kirchhoff):
//   rama izquierda: ε1 y R1 · rama central: R3 · rama derecha: ε2 y R2
// Sentidos de referencia: I1 e I2 SUBEN por sus ramas, I3 BAJA por la central.
//   Nodo A:          I1 + I2 = I3
//   Malla izquierda: ε1 − I1·R1 − I3·R3 = 0
//   Malla derecha:   ε2 − I2·R2 − I3·R3 = 0
// Sustituyendo I3 queda un sistema 2×2:  a·I1 + b·I2 = ε1 ,  c·I1 + d·I2 = ε2   (se resuelve con Cramer)
// Una corriente NEGATIVA significa que circula al revés del sentido de referencia.
function solveTwoMesh(e1, e2, R1, R2, R3) {
  const a = R1 + R3, b = R3, c = R3, d = R2 + R3;
  const det = a * d - b * c;                  // = R1R2 + R1R3 + R2R3
  const I1 = (e1 * d - b * e2) / det;
  const I2 = (a * e2 - c * e1) / det;
  return { a, b, c, d, det, I1, I2, I3: I1 + I2 };
}
Object.assign(CA, { solveCircuit, solveTwoMesh });
})();
