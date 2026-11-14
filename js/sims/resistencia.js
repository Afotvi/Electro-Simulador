(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { label } = CA;
const { MATERIALS, wireProps } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const $ = (id) => document.getElementById(id);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c]).join('');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const WIRE = '#4a5585';

const state = { mat: 'cobre', L: 100, A: 1, V: 12 };
const mat = () => MATERIALS.find((m) => m.id === state.mat);
let res = null, dirty = true;

// electrones libres (posición normalizada u a lo largo del cable, v a lo ancho)
const parts = Array.from({ length: 90 }, () => ({
  u: Math.random(), v: Math.random() * 1.8 - 0.9,
  p1: Math.random() * 6.28, p2: Math.random() * 6.28, w1: 2 + Math.random() * 3, w2: 2 + Math.random() * 3,
}));

// ---------- Geometría ----------
function geom(w) {
  const span = w - 160;
  const t = (Math.log10(state.L) - Math.log10(5)) / (Math.log10(200) - Math.log10(5));   // longitud en escala log (solo visual)
  const lenpx = span * (0.35 + 0.65 * t);
  const d = Math.sqrt((4 * state.A) / Math.PI);                                           // diámetro real en mm
  const dpx = 10 + 11.5 * d;
  const xa = (w - lenpx) / 2;
  return { lenpx, dpx, d, xa, xb: xa + lenpx, cy: 175 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------- Dibujo ----------
function drawWire(ctx, e, g) {
  const m = mat(), ins = m.kind === 'aislante';
  const { xa, xb, cy, dpx, lenpx } = g, top = cy - dpx / 2;

  // brillo por efecto Joule (potencia disipada)
  const heat = ins ? 0 : 1 - Math.exp(-res.P / 150);
  ctx.save();
  if (heat > 0.03) { ctx.shadowColor = `rgba(255,140,60,${0.9 * heat})`; ctx.shadowBlur = 34 * heat; }
  ctx.fillStyle = m.color; roundRect(ctx, xa, top, lenpx, dpx, Math.min(14, dpx / 2)); ctx.fill();
  ctx.restore();
  if (heat > 0.03) { ctx.fillStyle = `rgba(255,120,40,${0.45 * heat})`; roundRect(ctx, xa, top, lenpx, dpx, Math.min(14, dpx / 2)); ctx.fill(); }

  // interior: red de iones (+) y electrones libres
  ctx.save();
  roundRect(ctx, xa, top, lenpx, dpx, Math.min(14, dpx / 2)); ctx.clip();
  ctx.fillStyle = 'rgba(14,18,38,0.28)'; ctx.fillRect(xa, top, lenpx, dpx);
  const sp = 26;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = xa + sp / 2; x < xb; x += sp) for (let y = top + sp / 2; y < top + dpx; y += sp) { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
  const N = clamp(Math.round((lenpx * dpx) / 300), 6, 90), amp = ins ? 1 : 3;
  ctx.fillStyle = ins ? 'rgba(56,189,248,0.45)' : COLORS.neg;
  for (let i = 0; i < N; i++) {
    const p = parts[i];
    const x = xa + p.u * lenpx + Math.sin(e.time * p.w1 + p.p1) * amp;
    const y = cy + p.v * (dpx / 2 - 6) + Math.sin(e.time * p.w2 + p.p2) * amp;
    ctx.beginPath(); ctx.arc(x, y, 3.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; roundRect(ctx, xa, top, lenpx, dpx, Math.min(14, dpx / 2)); ctx.stroke();

  // terminales: + a la izquierda, − a la derecha (la corriente convencional va de + a −)
  ctx.lineCap = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(xa - 36, cy); ctx.lineTo(xa, cy); ctx.moveTo(xb, cy); ctx.lineTo(xb + 36, cy); ctx.stroke();
  [[xa - 36, COLORS.pos, '+'], [xb + 36, COLORS.neg, '−']].forEach(([x, c, s]) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, cy, 10, 0, Math.PI * 2); ctx.fill(); label(ctx, s, x, cy + 1, { color: '#0e1226', size: 15 });
  });
  label(ctx, `V = ${state.V} V`, (xa + xb) / 2, top - 44, { size: 15 });
  label(ctx, ins ? 'Aislante: los electrones están ligados a sus átomos' : 'Los electrones libres derivan hacia el + (contra la corriente convencional)', (xa + xb) / 2, top - 22, { color: COLORS.textDim, size: 11 });

  // cota de longitud
  const yd = cy + dpx / 2 + 30;
  ctx.strokeStyle = COLORS.textDim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xa, yd); ctx.lineTo(xb, yd); ctx.moveTo(xa, yd - 6); ctx.lineTo(xa, yd + 6); ctx.moveTo(xb, yd - 6); ctx.lineTo(xb, yd + 6); ctx.stroke();
  label(ctx, `L = ${state.L} m`, (xa + xb) / 2, yd + 16, { size: 13 });
  label(ctx, '(el dibujo no está a escala real)', (xa + xb) / 2, yd + 32, { color: COLORS.textDim, size: 10 });
}

function drawSection(ctx, e, g) {   // corte transversal del cable
  const x = e.w - 70, y = 62, r = g.dpx / 2;
  ctx.fillStyle = mat().color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  label(ctx, 'Sección', x, y - r - 14, { color: COLORS.textDim, size: 11 });
  label(ctx, `A = ${state.A} mm²`, x, y + r + 14, { size: 12 });
}

function drawRuler(ctx, e) {            // escala logarítmica de resistividad: conductores vs aislantes
  const x0 = 50, x1 = e.w - 50, ry = e.h - 95, lo = -9, hi = 14;
  const X = (rho) => x0 + ((Math.log10(rho) - lo) / (hi - lo)) * (x1 - x0);
  const zones = [[-9, -4, '#14b8a6', 'Conductores'], [-4, 8, '#fde047', 'Intermedios'], [8, 14, '#7c5cff', 'Aislantes']];
  label(ctx, 'Resistividad ρ (Ω·m), escala logarítmica · zonas aproximadas', x0, ry - 22, { align: 'left', color: COLORS.textDim, size: 11 });
  zones.forEach(([a, b, c, name]) => {
    const xa = x0 + ((a - lo) / (hi - lo)) * (x1 - x0), xb = x0 + ((b - lo) / (hi - lo)) * (x1 - x0);
    ctx.fillStyle = c + '55'; ctx.fillRect(xa, ry - 9, xb - xa, 18);
    label(ctx, name, (xa + xb) / 2, ry, { size: 11 });
  });
  for (let k = -8; k <= 12; k += 4) { const x = X(10 ** k); label(ctx, `10${sup(k)}`, x, ry + 17, { color: COLORS.textDim, size: 10 }); }
  MATERIALS.forEach((m) => {
    const x = X(m.rho), sel = m.id === state.mat;
    ctx.fillStyle = sel ? '#fff' : 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x, ry, sel ? 6 : 3, 0, Math.PI * 2); ctx.fill();
    if (sel) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, ry + 24); ctx.lineTo(x, ry + 10); ctx.stroke();
      label(ctx, `${m.name}: ρ = ${fmt(m.rho)} Ω·m`, clamp(x, 110, e.w - 110), ry + 40, { size: 12 });
    }
  });
}

const sim = new SimCanvas($('stage'), {
  scale: 1,
  update(dt, e) {
    if (dirty) { res = wireProps(mat(), state.L, state.A, state.V); refreshPanel(); dirty = false; }
    const g = geom(e.w), ins = mat().kind === 'aislante';
    // velocidad VISUAL de deriva: escala logarítmica de la corriente (la real es ~mm/s, imposible de ver)
    const vis = ins ? 0 : 160 * clamp((Math.log10(Math.max(res.I, 1e-30)) + 6) / 8, 0, 1);
    for (const p of parts) { p.u -= (vis * dt) / g.lenpx; if (p.u < 0) p.u += 1; }
  },
  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    if (!res) return;
    const g = geom(e.w);
    drawWire(ctx, e, g); drawSection(ctx, e, g); drawRuler(ctx, e);
  },
});

// ---------- Panel ----------
function refreshPanel() {
  const m = mat(), r = res, ins = m.kind === 'aislante';
  const fmtI = (I) => (I >= 1 ? `${fmt(I)} A` : I >= 1e-3 ? `${fmt(I * 1000)} mA` : `${fmt(I)} A`);
  $('R').textContent = `${fmt(r.R)} Ω`;
  $('I').textContent = fmtI(r.I);
  $('P').textContent = `${fmt(r.P)} W`;
  $('J').textContent = `${fmt(r.J)} A/m²`;
  $('E').textContent = `${fmt(r.E)} V/m`;
  $('vd').textContent = r.vd == null ? 'n/d' : `${fmt(r.vd * 1000)} mm/s`;
  const w = $('warn');
  w.hidden = !(ins || r.I > 20);
  w.textContent = ins ? 'Aislante: casi no pasa corriente aunque haya voltaje.' : '⚠ Corriente muy alta: un cable real se calentaría y podría fundirse (por eso se usan fusibles).';

  $('formula').textContent =
    `R = ρ·L / A\n  = (${fmt(m.rho)})(${state.L}) / (${fmt(r.A)})\n  = ${fmt(r.R)} Ω\n` +
    `I = V / R = ${state.V} / ${fmt(r.R)} = ${fmtI(r.I)}\n` +
    `J = I / A = ${fmt(r.J)} A/m²\n` +
    `E = V / L = ${fmt(r.E)} V/m   (= ρ·J ✔)\n` +
    (r.vd != null ? `v_d = I / (n·e·A) = ${fmt(r.vd * 1000)} mm/s`
      : ins ? `v_d: no aplica (no hay electrones libres)` : `v_d: falta la densidad de electrones n de este material`);
}

function syncControls() {
  $('mat').value = state.mat;
  $('Lv').textContent = `${state.L} m`; $('L').value = state.L;
  $('Av').textContent = `${state.A} mm²`; $('A').value = state.A;
  $('Vv').textContent = `${state.V} V`; $('V').value = state.V;
}

$('mat').innerHTML = MATERIALS.map((m) => `<option value="${m.id}">${m.name} (ρ = ${fmt(m.rho)} Ω·m)</option>`).join('');
$('mat').addEventListener('change', () => { state.mat = $('mat').value; dirty = true; });
[['L', 'L'], ['A', 'A'], ['V', 'V']].forEach(([id, key]) => $(id).addEventListener('input', () => { state[key] = parseFloat($(id).value); syncControls(); dirty = true; }));
$('exercise').addEventListener('click', () => {
  Object.assign(state, { mat: 'cobre', L: 100, A: 1, V: 12 }); syncControls(); dirty = true;
  $('exhint').textContent = 'Calcula R = ρL/A con ρ = 1,68×10⁻⁸ Ω·m. Debe dar 1,68 Ω. Ahora duplica L: ¿qué le pasa a R? ¿Y si duplicas A? Cambia a vidrio: ¿cuánta corriente pasa?';
});

syncControls();
sim.start();
})();
