(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Líneas de nivel (equipotenciales) con el algoritmo "marching squares".
// vals: Float32Array con (nx+1)*(ny+1) valores en los VÉRTICES de una cuadrícula; índice = j*(nx+1)+i.
// Devuelve segmentos [x1, y1, x2, y2] en unidades de celda (multiplica por el tamaño de celda en px).
function contourSegments(vals, nx, ny, level) {
  const W = nx + 1, out = [];
  const t = (v1, v2) => (level - v1) / (v2 - v1);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = vals[j * W + i], b = vals[j * W + i + 1], c = vals[(j + 1) * W + i + 1], d = vals[(j + 1) * W + i];
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      // a = arriba-izq, b = arriba-der, c = abajo-der, d = abajo-izq
      const T = [i + t(a, b), j], R = [i + 1, j + t(b, c)], B = [i + t(d, c), j + 1], L = [i, j + t(a, d)];
      const seg = (p, q) => out.push([p[0], p[1], q[0], q[1]]);
      switch (idx) {
        case 1: case 14: seg(L, B); break;
        case 2: case 13: seg(B, R); break;
        case 3: case 12: seg(L, R); break;
        case 4: case 11: seg(T, R); break;
        case 5: seg(T, L); seg(B, R); break;     // punto de silla
        case 6: case 9: seg(T, B); break;
        case 7: case 8: seg(T, L); break;
        case 10: seg(T, R); seg(L, B); break;    // punto de silla
      }
    }
  }
  return out;
}
Object.assign(CA, { contourSegments });
})();
