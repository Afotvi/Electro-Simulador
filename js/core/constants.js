(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Constantes físicas (SI). Todas las simulaciones trabajan en metros, newtons, culombios, etc.
const K       = 8.9875e9;          // N·m²/C²   constante de Coulomb
const EPS0    = 8.8542e-12;        // C²/(N·m²) permitividad del vacío
const MU0     = 4 * Math.PI * 1e-7;// T·m/A     permeabilidad del vacío
const E_CHARGE = 1.602e-19;        // C         carga elemental
const M_ELECTRON = 9.109e-31;      // kg
Object.assign(CA, { K, EPS0, MU0, E_CHARGE, M_ELECTRON });
})();
