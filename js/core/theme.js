(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Colores para el canvas (deben coincidir con las variables de css/base.css)
const COLORS = {
  stage: '#0e1226',
  grid: 'rgba(255,255,255,0.06)',
  gridStrong: 'rgba(255,255,255,0.12)',
  text: '#e8ecff',
  textDim: 'rgba(232,236,255,0.6)',
  pos: '#ff5a4e',
  neg: '#38bdf8',
  force: '#fde047',
  field: '#a78bfa',
};
Object.assign(CA, { COLORS });
})();
