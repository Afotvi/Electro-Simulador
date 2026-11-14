(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Única fuente de verdad: la navbar y la página de inicio se generan desde aquí.

const UNITS = {
  1: { name: 'Unidad 1 · Electrostática', color: 'var(--u1)' },
  2: { name: 'Unidad 2 · Circuitos', color: 'var(--u2)' },
  3: { name: 'Unidad 3 · Magnetismo', color: 'var(--u3)' },
};

const SIMS = [
  { id: 'coulomb',         unit: 1, icon: '⚡', title: 'Ley de Coulomb',         desc: 'Mueve cargas y mira la fuerza entre ellas.', ready: true },
  { id: 'campo-electrico', unit: 1, icon: '🧭', title: 'Campo eléctrico',        desc: 'Líneas de campo y carga de prueba.', ready: true },
  { id: 'gauss',           unit: 1, icon: '🫧', title: 'Ley de Gauss',           desc: 'Flujo a través de superficies cerradas.', ready: true },
  { id: 'potencial',       unit: 2, icon: '🗻', title: 'Potencial eléctrico',    desc: 'Mapa de potencial y equipotenciales.', ready: true},
  { id: 'capacitores',     unit: 2, icon: '🔋', title: 'Capacitores',            desc: 'Placas, dieléctricos y energía.', ready: true },
  { id: 'resistencia',     unit: 2, icon: '🧵', title: 'Resistencia',            desc: 'Corriente, resistividad y materiales.', ready:true},
  { id: 'ohm',             unit: 2, icon: '💡', title: 'Ley de Ohm y circuitos', desc: 'Serie, paralelo y combinado.', ready: true},
  { id: 'kirchhoff',       unit: 2, icon: '🔀', title: 'Leyes de Kirchhoff',     desc: 'Nodos y mallas.', ready: true},
  { id: 'biot-savart',     unit: 3, icon: '🌀', title: 'Biot-Savart',            desc: 'Campo de una espira y un solenoide.' },
  { id: 'ampere',          unit: 3, icon: '🧲', title: 'Ley de Ampère',          desc: 'Conductor recto y solenoide.' },
  { id: 'faraday',         unit: 3, icon: '🔄', title: 'Ley de Faraday',         desc: 'Imán, bobina y corriente inducida.' },
  { id: 'lorentz',         unit: 3, icon: '🛰️', title: 'Fuerza de Lorentz',      desc: 'Partículas en un campo magnético.' },
];

const simUrl = (s, root) => `${root}simuladores/${s.id}.html`;
Object.assign(CA, { UNITS, SIMS, simUrl });
})();
