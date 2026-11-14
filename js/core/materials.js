(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { E_CHARGE } = CA;
// Materiales y cálculo de un cable (módulo puro, sin DOM).
// Valores típicos a 20 °C de tablas de libro de texto; pueden variar un poco según el libro.
// n = densidad de electrones libres (m⁻³), solo donde el valor es estándar; null = no disponible.

const MATERIALS = [
  { id: 'plata',    name: 'Plata',          rho: 1.59e-8, n: 5.86e28, color: '#d9dde8', kind: 'conductor' },
  { id: 'cobre',    name: 'Cobre',          rho: 1.68e-8, n: 8.5e28,  color: '#d98a4e', kind: 'conductor' },
  { id: 'oro',      name: 'Oro',            rho: 2.44e-8, n: 5.9e28,  color: '#e6c14d', kind: 'conductor' },
  { id: 'aluminio', name: 'Aluminio',       rho: 2.65e-8, n: 1.81e29, color: '#b9c2d0', kind: 'conductor' },
  { id: 'hierro',   name: 'Hierro',         rho: 9.71e-8, n: null,    color: '#7d8594', kind: 'conductor' },
  { id: 'nicromo',  name: 'Nicromo',        rho: 1.10e-6, n: null,    color: '#8a7a8f', kind: 'conductor' },
  { id: 'carbono',  name: 'Carbono (grafito)', rho: 3.5e-5, n: null,  color: '#4a4f63', kind: 'conductor' },
  { id: 'vidrio',   name: 'Vidrio',         rho: 1e12,    n: null,    color: 'rgba(150,210,230,0.55)', kind: 'aislante' },
  { id: 'caucho',   name: 'Caucho duro',    rho: 1e13,    n: null,    color: '#3a3544', kind: 'aislante' },
];

// R = ρL/A · I = V/R · J = I/A · E = V/L · v_d = I/(n·e·A) · P = V·I
// L en metros, A en mm², V en voltios.
function wireProps(mat, L, A_mm2, V) {
  const A = A_mm2 * 1e-6;
  const R = (mat.rho * L) / A;
  const I = V / R;
  return { A, R, I, J: I / A, E: V / L, P: V * I, vd: mat.n ? I / (mat.n * E_CHARGE * A) : null };
}
Object.assign(CA, { MATERIALS, wireProps });
})();
