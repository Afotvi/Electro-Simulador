(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { label } = CA;
const { solveCircuit } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const SUB = ['₁', '₂', '₃'];
const SPACING = 24;               // separación entre puntitos de corriente (px)
const WIRE = '#4a5585';
const BULB_R = 19;

const state = { mode: 'serie', V: 12, R: [100, 200, 300], open: [false, false, false] };
const EXERCISES = {
  serie:     { R: [100, 200, 300], hint: 'Calcula R_eq, la corriente y el voltaje de cada resistencia, y compara con el panel. Resultado esperado: R_eq = 600 Ω, I = 20 mA, V = 2, 4 y 6 V.' },
  paralelo:  { R: [100, 200, 300], hint: 'Calcula la corriente de cada rama y la total. Resultado esperado: I = 120 + 60 + 40 = 220 mA y R_eq ≈ 54,5 Ω.' },
  combinado: { R: [40, 60, 30],    hint: 'Primero R₂ ∥ R₃, luego súmale R₁. Resultado esperado: R₂₃ = 20 Ω, R_eq = 60 Ω, I = 200 mA.' },
};

const $ = (id) => document.getElementById(id);
const fmtI = (I) => (Math.abs(I) >= 1 ? `${fmt(I)} A` : `${fmt(I * 1000)} mA`);
const fmtR = (R) => (Number.isFinite(R) ? `${fmt(R)} Ω` : '∞');

let res = null, lay = null, dirty = true;
const phases = {};

// ---------- Geometría del circuito (en píxeles de pantalla) ----------
function layout(w, h) {
  const x0 = 70, x1 = Math.max(x0 + 170, w - 150), y0 = 110, y1 = h - 110, ym = (y0 + y1) / 2, bt = 22;
  const stubUp = [x0, ym - bt], stubDown = [x0, ym + bt];     // terminales de la batería
  const segs = {}, bulbs = [];
  if (state.mode === 'serie') {
    segs.S1 = [stubUp, [x0, y0], [x1, y0]];
    segs.S2 = [[x1, y0], [x1, y1]];
    segs.S3 = [[x1, y1], [x0, y1], stubDown];
    bulbs.push({ i: 0, x: (x0 + x1) / 2, y: y0, vert: false }, { i: 1, x: x1, y: ym, vert: true }, { i: 2, x: (x0 + x1) / 2, y: y1, vert: false });
  } else if (state.mode === 'paralelo') {
    const xa = x0 + (x1 - x0) / 3, xb = x0 + (2 * (x1 - x0)) / 3, xc = x1;
    segs.T0 = [stubUp, [x0, y0], [xa, y0]]; segs.T1 = [[xa, y0], [xb, y0]]; segs.T2 = [[xb, y0], [xc, y0]];
    segs.B1 = [[xa, y0], [xa, y1]]; segs.B2 = [[xb, y0], [xb, y1]]; segs.B3 = [[xc, y0], [xc, y1]];
    segs.Bt2 = [[xc, y1], [xb, y1]]; segs.Bt1 = [[xb, y1], [xa, y1]]; segs.Bt0 = [[xa, y1], [x0, y1], stubDown];
    bulbs.push({ i: 0, x: xa, y: ym, vert: true }, { i: 1, x: xb, y: ym, vert: true }, { i: 2, x: xc, y: ym, vert: true });
  } else {
    const xb = (x0 + x1) / 2, xc = x1;
    segs.T0 = [stubUp, [x0, y0], [xb, y0]]; segs.T1 = [[xb, y0], [xc, y0]];
    segs.B2 = [[xb, y0], [xb, y1]]; segs.B3 = [[xc, y0], [xc, y1]];
    segs.Bt1 = [[xc, y1], [xb, y1]]; segs.Bt0 = [[xb, y1], [x0, y1], stubDown];
    bulbs.push({ i: 0, x: (x0 + xb) / 2, y: y0, vert: false }, { i: 1, x: xb, y: ym, vert: true }, { i: 2, x: xc, y: ym, vert: true });
  }
  return { x0, ym, bt, segs, bulbs };
}

// Corriente que circula por cada tramo de cable (para animar los puntitos)
function segCurrents() {
  const it = res.items, I = res.I;
  if (state.mode === 'serie') return { S1: I, S2: I, S3: I };
  if (state.mode === 'paralelo') {
    return { T0: I, T1: it[1].I + it[2].I, T2: it[2].I, B1: it[0].I, B2: it[1].I, B3: it[2].I, Bt2: it[2].I, Bt1: it[1].I + it[2].I, Bt0: I };
  }
  return { T0: I, T1: it[2].I, B2: it[1].I, B3: it[2].I, Bt1: it[2].I, Bt0: I };
}

function pointAt(pts, d) {   // punto a distancia d (px) a lo largo de una polilínea
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay);
    if (d <= L) return [ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L];
    d -= L;
  }
  return null;
}
const length = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);

// ---------- Dibujo ----------
function drawBulb(ctx, b) {
  const it = res.items[b.i], open = state.open[b.i];
  const br = 1 - Math.exp(-it.P / 1.5);                         // brillo según la potencia (saturado)
  if (br > 0.02) {
    const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 78);
    g.addColorStop(0, `rgba(253,224,71,${0.55 * br})`); g.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 78, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1b2347'; ctx.beginPath(); ctx.arc(b.x, b.y, BULB_R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(253,224,71,${0.9 * br})`; ctx.beginPath(); ctx.arc(b.x, b.y, BULB_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = open ? COLORS.pos : '#8b95c9'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(b.x, b.y, BULB_R, 0, Math.PI * 2); ctx.stroke();
  if (open) {
    ctx.strokeStyle = COLORS.pos; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(b.x - 8, b.y - 8); ctx.lineTo(b.x + 8, b.y + 8); ctx.moveTo(b.x + 8, b.y - 8); ctx.lineTo(b.x - 8, b.y + 8); ctx.stroke();
  } else {                                                      // filamento en zigzag
    ctx.strokeStyle = br > 0.1 ? '#fffbe0' : '#8b95c9'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(b.x - 10, b.y + 4); ctx.lineTo(b.x - 5, b.y - 4); ctx.lineTo(b.x, b.y + 4); ctx.lineTo(b.x + 5, b.y - 4); ctx.lineTo(b.x + 10, b.y + 4); ctx.stroke();
  }
  const name = `R${SUB[b.i]} = ${state.R[b.i]} Ω${open ? ' (abierta)' : ''}`;
  const meas = `${fmt(it.V)} V · ${fmtI(it.I)}`;
  if (b.vert) {
    label(ctx, name, b.x + 30, b.y - 9, { align: 'left', size: 12 });
    label(ctx, meas, b.x + 30, b.y + 9, { align: 'left', size: 12, color: COLORS.force });
  } else {
    label(ctx, name, b.x, b.y - 36, { size: 12 });
    label(ctx, meas, b.x, b.y + 38, { size: 12, color: COLORS.force });
  }
}

function drawBattery(ctx, L) {
  const { x0, ym, bt } = L;
  ctx.lineCap = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x0, ym - bt); ctx.lineTo(x0, ym - 8); ctx.moveTo(x0, ym + 8); ctx.lineTo(x0, ym + bt); ctx.stroke();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 20, ym - 8); ctx.lineTo(x0 + 20, ym - 8); ctx.stroke();   // placa + (larga)
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0 - 10, ym + 8); ctx.lineTo(x0 + 10, ym + 8); ctx.stroke();                                    // placa − (corta)
  label(ctx, '+', x0 + 30, ym - 12, { color: COLORS.pos, size: 16 });
  label(ctx, '−', x0 + 30, ym + 13, { color: COLORS.neg, size: 16 });
  label(ctx, `${state.V} V`, x0 - 30, ym, { align: 'right', size: 16 });
}

const sim = new SimCanvas($('stage'), {
  scale: 1,
  update(dt) {
    if (dirty) { res = solveCircuit(state.mode, state.V, state.R, state.open); refreshPanel(); dirty = false; }
    const cur = segCurrents();
    for (const k in cur) phases[k] = ((phases[k] ?? 0) + Math.min(260, 500 * cur[k]) * dt) % SPACING;   // más corriente => más rápido
  },
  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    if (!res) return;
    lay = layout(e.w, e.h);
    const cur = segCurrents();

    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
    for (const k in lay.segs) { ctx.beginPath(); lay.segs[k].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }

    ctx.fillStyle = COLORS.force;                                  // puntitos = corriente convencional (de + a −)
    for (const k in lay.segs) {
      if (!(cur[k] > 1e-9)) continue;
      const pts = lay.segs[k], L = length(pts);
      for (let d = phases[k] ?? 0; d < L; d += SPACING) {
        const p = pointAt(pts, d); if (!p) continue;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawBattery(ctx, lay);
    lay.bulbs.forEach((b) => drawBulb(ctx, b));
    label(ctx, 'Toca un bombillo para fundirlo (abrir el circuito en esa parte)', e.w / 2, e.h - 22, { color: COLORS.textDim, size: 12 });
  },
  onDown(p, e) {
    const b = lay?.bulbs.find((q) => Math.hypot(q.x - p.sx, q.y - p.sy) < BULB_R + 6);
    if (b) { state.open[b.i] = !state.open[b.i]; dirty = true; }
  },
  onMove(p, e) {
    const over = lay?.bulbs.some((q) => Math.hypot(q.x - p.sx, q.y - p.sy) < BULB_R + 6);
    e.canvas.style.cursor = over ? 'pointer' : 'default';
  },
});

// ---------- Panel ----------
function stepsText() {
  const { mode, V, R } = state, r = res, it = r.items;
  const n = (i) => `R${SUB[i]}`;
  if (r.broken) return 'Circuito abierto: no hay camino completo para la corriente.\nI = 0 y todo el voltaje cae en la parte abierta.\nVuelve a tocar el bombillo para cerrarlo.';
  if (mode === 'serie') {
    return `R_eq = R₁ + R₂ + R₃ = ${R.join(' + ')} = ${fmt(r.Req)} Ω\nI = V / R_eq = ${fmt(V)} / ${fmt(r.Req)} = ${fmtI(r.I)}\n` +
      `(la misma I en todas)\nVᵢ = I·Rᵢ:\n${it.map((x, i) => `  V${SUB[i]} = ${fmt(x.V)} V`).join('\n')}\nΣVᵢ = ${fmt(it.reduce((s, x) => s + x.V, 0))} V = V ✔`;
  }
  if (mode === 'paralelo') {
    return `Mismo voltaje en cada rama: V = ${fmt(V)} V\nIᵢ = V / Rᵢ:\n${it.map((x, i) => `  I${SUB[i]} = ${fmt(V)} / ${R[i]} = ${fmtI(x.I)}`).join('\n')}\n` +
      `I = I₁ + I₂ + I₃ = ${fmtI(r.I)}\n1/R_eq = Σ 1/Rᵢ  →  R_eq = ${fmt(r.Req)} Ω`;
  }
  return `R₂₃ = 1 / (1/R₂ + 1/R₃) = ${fmt(r.R23)} Ω   (paralelo)\nR_eq = R₁ + R₂₃ = ${fmt(r.Req)} Ω\nI = V / R_eq = ${fmtI(r.I)}\n` +
    `V₁ = I·R₁ = ${fmt(it[0].V)} V\nV₂₃ = I·R₂₃ = ${fmt(r.V23)} V\nI₂ = V₂₃/R₂ = ${fmtI(it[1].I)}\nI₃ = V₂₃/R₃ = ${fmtI(it[2].I)}`;
}

function refreshPanel() {
  const pt = res.items.reduce((s, x) => s + x.P, 0);
  $('req').textContent = fmtR(res.Req);
  $('itot').textContent = fmtI(res.I);
  $('ptot').textContent = `${fmt(pt)} W`;
  $('tbl').innerHTML = `<table class="tbl"><tr><th></th><th>R</th><th>V</th><th>I</th><th>P</th></tr>` +
    res.items.map((x, i) => `<tr><td>R${SUB[i]}</td><td>${state.R[i]} Ω</td><td>${fmt(x.V)} V</td><td>${fmtI(x.I)}</td><td>${fmt(x.P)} W</td></tr>`).join('') + `</table>`;
  $('formula').textContent = stepsText();
}

function syncControls() {
  $('v').value = state.V; $('vv').textContent = `${state.V} V`;
  [1, 2, 3].forEach((n) => { $(`r${n}`).value = state.R[n - 1]; $(`r${n}v`).textContent = `${state.R[n - 1]} Ω`; });
  [['serie', 'mSerie'], ['paralelo', 'mPar'], ['combinado', 'mComb']].forEach(([m, id]) => { $(id).className = state.mode === m ? 'btn' : 'btn ghost'; });
  $('exhint').textContent = '';
}

$('v').addEventListener('input', () => { state.V = parseFloat($('v').value); $('vv').textContent = `${state.V} V`; dirty = true; });
[1, 2, 3].forEach((n) => $(`r${n}`).addEventListener('input', () => { state.R[n - 1] = parseFloat($(`r${n}`).value); $(`r${n}v`).textContent = `${state.R[n - 1]} Ω`; dirty = true; }));
[['serie', 'mSerie'], ['paralelo', 'mPar'], ['combinado', 'mComb']].forEach(([m, id]) =>
  $(id).addEventListener('click', () => { state.mode = m; state.open = [false, false, false]; syncControls(); dirty = true; }));
$('exercise').addEventListener('click', () => {
  const ex = EXERCISES[state.mode];
  state.V = 12; state.R = [...ex.R]; state.open = [false, false, false];
  syncControls(); $('exhint').textContent = ex.hint; dirty = true;
});

syncControls();
sim.start();
})();
