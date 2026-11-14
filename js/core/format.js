(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Formato de números en español (coma decimal) y notación científica legible.
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const toSup = (n) => String(n).split('').map((c) => SUP[c]).join('');

function fmt(n, sig = 3) {
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e-3 && a < 1e4) {
    return Number(n.toPrecision(sig)).toLocaleString('es-CO', { maximumFractionDigits: 6 });
  }
  const [m, e] = n.toExponential(sig - 1).split('e');
  return `${m.replace('.', ',')}×10${toSup(parseInt(e, 10))}`;
}

// Número con prefijo SI automático: si(88.5e-12, 'F') -> "88,5 pF"
function si(v, unit = '') {
  if (v === 0) return `0 ${unit}`.trim();
  if (!Number.isFinite(v)) return `∞ ${unit}`.trim();
  const a = Math.abs(v);
  const P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  const [f, p] = P.find(([f]) => a >= f * 0.9995) ?? P[P.length - 1];
  return `${fmt(v / f)} ${p}${unit}`;
}
Object.assign(CA, { fmt, si });
})();
