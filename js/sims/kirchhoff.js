(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { label } = CA;
const { solveTwoMesh } = CA;
const { COLORS } = CA;
const { fmt } = CA;

mountNavbar();

const SUB = ['₁', '₂', '₃'];
const SPACING = 24, WIRE = '#4a5585';
const state = { e1: 12, e2: 6, R: [20, 30, 60], hide: false };   // hide = modo ejercicio (oculta las respuestas)

const $ = (id) => document.getElementById(id);
const fmtI = (I) => (Math.abs(I) >= 1 ? `${fmt(I)} A` : `${fmt(I * 1000)} mA`);
const zero = (x) => (Math.abs(x) < 1e-9 ? 0 : x);               // evita mostrar 1e-16 en las comprobaciones

let res = null, dirty = true;
const phases = {};

// ---------- Geometría ----------
function layout(w, h) {
  const xl = w * 0.22, xm = w * 0.5, xr = w * 0.78, y0 = 90, y1 = h - 90, H = y1 - y0;
  return {
    xl, xm, xr, y0, y1, yR: y0 + 0.27 * H, yB: y0 + 0.72 * H, yM: y0 + 0.5 * H,
    segs: {   // cada tramo dibujado en el sentido de referencia de su corriente
      L: [[xl, y1], [xl, y0]], TL: [[xl, y0], [xm, y0]],
      M: [[xm, y0], [xm, y1]],
      R: [[xr, y1], [xr, y0]], TR: [[xr, y0], [xm, y0]],
      BL: [[xm, y1], [xl, y1]], BR: [[xm, y1], [xr, y1]],
    },
  };
}
const segCur = () => ({ L: res.I1, TL: res.I1, M: res.I3, R: res.I2, TR: res.I2, BL: res.I1, BR: res.I2 });

function pointAt(pts, d) {
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay);
    if (d <= L) return [ax + ((bx - ax) * d) / L, ay + ((by - ay) * d) / L];
    d -= L;
  }
  return null;
}
const length = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);

// ---------- Dibujo de componentes ----------
function drawResistor(ctx, x, cy, P) {
  const br = state.hide ? 0 : 1 - Math.exp(-P / 1.5);
  if (br > 0.02) {
    const g = ctx.createRadialGradient(x, cy, 6, x, cy, 60);
    g.addColorStop(0, `rgba(253,224,71,${0.5 * br})`); g.addColorStop(1, 'rgba(253,224,71,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, 60, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = COLORS.stage; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, cy - 30); ctx.lineTo(x, cy + 30); ctx.stroke();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x, cy - 28);
  for (let k = 1; k <= 5; k++) ctx.lineTo(x + (k % 2 ? 9 : -9), cy - 28 + (56 * k) / 6);
  ctx.lineTo(x, cy + 28); ctx.stroke();
}

function drawBattery(ctx, x, cy, eps) {
  const s = eps >= 0 ? 1 : -1;                       // s = +1: el + queda arriba
  const longY = cy - 6 * s, shortY = cy + 6 * s;
  ctx.strokeStyle = COLORS.stage; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x, cy - 13); ctx.lineTo(x, cy + 13); ctx.stroke();
  ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, cy - 13); ctx.lineTo(x, cy - 6); ctx.moveTo(x, cy + 6); ctx.lineTo(x, cy + 13); ctx.stroke();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 15, longY); ctx.lineTo(x + 15, longY); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 8, shortY); ctx.lineTo(x + 8, shortY); ctx.stroke();
  label(ctx, '+', x + 24, longY, { color: COLORS.pos, size: 15 });
}

function refArrow(ctx, x, y, up) {                    // triangulito = sentido de referencia
  const d = up ? -1 : 1;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x, y + 7 * d); ctx.lineTo(x - 6, y - 5 * d); ctx.lineTo(x + 6, y - 5 * d); ctx.closePath(); ctx.fill();
}

const sim = new SimCanvas($('stage'), {
  scale: 1,
  update(dt) {
    if (dirty) { res = solveTwoMesh(state.e1, state.e2, ...state.R); refreshPanel(); dirty = false; }
    const cur = segCur();
    for (const k in cur) phases[k] = ((phases[k] ?? 0) + Math.min(260, 500 * Math.abs(cur[k])) * dt) % SPACING;
  },
  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    if (!res) return;
    const L = layout(e.w, e.h), cur = segCur(), { xl, xm, xr, y0, y1, yR, yB, yM } = L;

    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
    for (const k in L.segs) { ctx.beginPath(); L.segs[k].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }

    if (!state.hide) {                                  // puntitos: si la corriente es negativa, van al revés
      ctx.fillStyle = COLORS.force;
      for (const k in L.segs) {
        const I = cur[k]; if (Math.abs(I) < 1e-9) continue;
        const pts = I >= 0 ? L.segs[k] : [...L.segs[k]].reverse(), len = length(pts);
        for (let d = phases[k] ?? 0; d < len; d += SPACING) {
          const p = pointAt(pts, d); if (!p) continue;
          ctx.beginPath(); ctx.arc(p[0], p[1], 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    [[xm, y0], [xm, y1]].forEach(([x, y]) => { ctx.fillStyle = '#e8ecff'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); });
    label(ctx, 'A', xm, y0 - 18, { size: 15 }); label(ctx, 'B', xm, y1 + 20, { size: 15 });

    drawResistor(ctx, xl, yR, res.I1 ** 2 * state.R[0]);
    drawResistor(ctx, xr, yR, res.I2 ** 2 * state.R[1]);
    drawResistor(ctx, xm, yM, res.I3 ** 2 * state.R[2]);
    drawBattery(ctx, xl, yB, state.e1);
    drawBattery(ctx, xr, yB, state.e2);

    // etiquetas
    const q = (v) => (state.hide ? '?' : v);
    const side = (x, left) => ({ x: x + (left ? -32 : 32), align: left ? 'right' : 'left' });
    const rLabel = (x, y, i, I, left) => {
      const s = side(x, left);
      label(ctx, `R${SUB[i]} = ${state.R[i]} Ω`, s.x, y - 9, { align: s.align, size: 12 });
      label(ctx, `V = ${q(`${fmt(Math.abs(I) * state.R[i])} V`)}`, s.x, y + 9, { align: s.align, size: 12, color: COLORS.force });
    };
    rLabel(xl, yR, 0, res.I1, true); rLabel(xr, yR, 1, res.I2, false); rLabel(xm, yM, 2, res.I3, false);
    label(ctx, `ε₁ = ${state.e1} V`, xl - 32, yB, { align: 'right', size: 12 });
    label(ctx, `ε₂ = ${state.e2} V`, xr + 32, yB, { align: 'left', size: 12 });

    label(ctx, `I₁ = ${q(fmtI(res.I1))}`, xl - 32, yM, { align: 'right', size: 13, color: COLORS.field });
    label(ctx, `I₂ = ${q(fmtI(res.I2))}`, xr + 32, yM, { align: 'left', size: 13, color: COLORS.field });
    label(ctx, `I₃ = ${q(fmtI(res.I3))}`, xm + 32, yB, { align: 'left', size: 13, color: COLORS.field });
    refArrow(ctx, xl, yM, true); refArrow(ctx, xr, yM, true); refArrow(ctx, xm, yB, false);

    label(ctx, 'Triángulos = sentido de referencia: I₁ e I₂ suben, I₃ baja.', e.w / 2, e.h - 34, { color: COLORS.textDim, size: 11 });
    label(ctx, 'Si una corriente sale negativa, circula al revés.', e.w / 2, e.h - 18, { color: COLORS.textDim, size: 11 });
  },
});

// ---------- Panel ----------
function solutionText() {
  const { e1, e2, R } = state, r = res;
  let t = `1) Sentidos de referencia: I₁ e I₂ suben, I₃ baja.\n` +
    `2) Nodo A:  I₁ + I₂ = I₃\n` +
    `3) Malla izquierda:  ε₁ − I₁R₁ − I₃R₃ = 0\n` +
    `4) Malla derecha:    ε₂ − I₂R₂ − I₃R₃ = 0\n` +
    `5) Sustituye I₃ = I₁ + I₂ :\n` +
    `   ${r.a}·I₁ + ${r.b}·I₂ = ${e1}\n   ${r.c}·I₁ + ${r.d}·I₂ = ${e2}\n` +
    `6) Resuelve el 2×2 (Cramer):\n   det = ${r.a}·${r.d} − ${r.b}·${r.c} = ${r.det}`;
  if (!state.hide) {
    t += `\n   I₁ = (${e1}·${r.d} − ${r.b}·${e2}) / ${r.det} = ${fmtI(r.I1)}` +
         `\n   I₂ = (${r.a}·${e2} − ${r.c}·${e1}) / ${r.det} = ${fmtI(r.I2)}` +
         `\n   I₃ = I₁ + I₂ = ${fmtI(r.I3)}`;
  }
  return t;
}

function checkText() {
  const { e1, e2, R } = state, r = res;
  const v1 = r.I1 * R[0], v2 = r.I2 * R[1], v3 = r.I3 * R[2];
  return `Nodo A:\n  I₁ + I₂ − I₃ = ${fmt(zero(r.I1 + r.I2 - r.I3))} A\n` +
    `Malla izquierda:\n  ε₁ − I₁R₁ − I₃R₃ = ${fmt(e1)} − ${fmt(v1)} − ${fmt(v3)} = ${fmt(zero(e1 - v1 - v3))} V\n` +
    `Malla derecha:\n  ε₂ − I₂R₂ − I₃R₃ = ${fmt(e2)} − ${fmt(v2)} − ${fmt(v3)} = ${fmt(zero(e2 - v2 - v3))} V`;
}

function refreshPanel() {
  const q = (v) => (state.hide ? '?' : v);
  $('i1').textContent = q(fmtI(res.I1)); $('i2').textContent = q(fmtI(res.I2)); $('i3').textContent = q(fmtI(res.I3));
  $('formula').textContent = solutionText();
  $('verif').hidden = state.hide;
  if (!state.hide) $('check').textContent = checkText();
}

function syncControls() {
  $('e1').value = state.e1; $('e1v').textContent = `${state.e1 > 0 ? '+' : ''}${state.e1} V`;
  $('e2').value = state.e2; $('e2v').textContent = `${state.e2 > 0 ? '+' : ''}${state.e2} V`;
  [1, 2, 3].forEach((n) => { $(`r${n}`).value = state.R[n - 1]; $(`r${n}v`).textContent = `${state.R[n - 1]} Ω`; });
  $('hideAns').checked = state.hide;
}

[['e1', 'e1'], ['e2', 'e2']].forEach(([id, key]) => $(id).addEventListener('input', () => { state[key] = parseFloat($(id).value); syncControls(); dirty = true; }));
[1, 2, 3].forEach((n) => $(`r${n}`).addEventListener('input', () => { state.R[n - 1] = parseFloat($(`r${n}`).value); syncControls(); dirty = true; }));
$('hideAns').addEventListener('change', () => { state.hide = $('hideAns').checked; dirty = true; });

// ---------- Modo práctica ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function clearAnswers() { [1, 2, 3].forEach((n) => { $(`a${n}`).value = ''; $(`s${n}`).textContent = ''; }); $('fb').textContent = ''; }

$('newEx').addEventListener('click', () => {
  let r;
  do {   // evita corrientes casi nulas (ejercicios aburridos)
    state.e1 = pick([6, 9, 12, 15, 18, 24]); state.e2 = pick([-12, -9, -6, 3, 6, 9, 12]);
    state.R = [pick([10, 20, 30, 40, 50, 100]), pick([10, 20, 30, 40, 50, 100]), pick([20, 30, 40, 60, 100, 150])];
    r = solveTwoMesh(state.e1, state.e2, ...state.R);
  } while ([r.I1, r.I2, r.I3].some((I) => Math.abs(I) < 0.005));
  state.hide = true; clearAnswers(); $('sol').open = false; syncControls(); dirty = true;
  $('fb').textContent = 'Resuelve I₁, I₂ e I₃ (en mA, con el signo según los sentidos de referencia) y pulsa Comprobar.';
});

$('verify').addEventListener('click', () => {
  const truth = [res.I1, res.I2, res.I3].map((x) => x * 1000);
  let ok = 0, filled = 0; const msgs = [];
  [1, 2, 3].forEach((n, i) => {
    const v = parseFloat($(`a${n}`).value.replace(',', '.')), st = $(`s${n}`);
    if (Number.isNaN(v)) { st.textContent = ''; return; }
    filled++;
    const tol = Math.max(0.5, Math.abs(truth[i]) * 0.01);
    if (Math.abs(v - truth[i]) <= tol) { st.textContent = '✔'; ok++; }
    else { st.textContent = '✘'; if (Math.abs(v + truth[i]) <= tol) msgs.push(`I${SUB[i]}: el valor está bien pero el signo no; revisa el sentido de referencia.`); }
  });
  if (!filled) { $('fb').textContent = 'Escribe al menos una respuesta.'; return; }
  if (ok === 3) { $('fb').textContent = '¡Correcto! Las tres corrientes coinciden. Ya puedes ver el desarrollo.'; state.hide = false; syncControls(); dirty = true; }
  else $('fb').textContent = `${ok} de ${filled} bien. ${msgs.join(' ')} Pista: empieza por el nodo A y las dos mallas.`;
});

syncControls();
sim.start();
})();
