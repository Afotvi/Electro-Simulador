(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SimCanvas } = CA;
const { label } = CA;
const { DIELECTRICS, plateCapacitor, solveCaps } = CA;
const { EPS0 } = CA;
const { COLORS } = CA;
const { fmt, si } = CA;

mountNavbar();

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const SUB = ['₁', '₂', '₃'];
const WIRE = '#4a5585';
const S = { view: 'placas', A: 100, d: 1, V: 12, diel: 'aire', x: 0, conn: true, Qfix: 0, mode: 'serie', Vc: 12, C: [10, 20, 60] };  // C en µF
const diel = () => DIELECTRICS.find((m) => m.id === S.diel);
const plateIn = () => plateCapacitor({ A_cm2: S.A, d_mm: S.d, kappa: diel().kappa, x: S.x / 100, V: S.V, Q: S.Qfix, connected: S.conn });
const caps = () => solveCaps(S.mode, S.Vc, S.C.map((c) => c * 1e-6));

let pr = null, cr = null, dirty = true;

// ---------- Animación ----------
let qd = 0, cd = [0, 0, 0];      // carga MOSTRADA (va persiguiendo a la final, como una carga RC real)
let flow = 0, flowG = 0, dotPhase = 0, disch = null;   // flujo de puntitos · fracción pendiente · fase · descarga en curso
const SP = 22;

// Puntitos de corriente sobre una polilínea (rev = recorrerla al revés)
function drawDots(ctx, pts, rev) {
  const P = rev ? [...pts].reverse() : pts, segs = []; let total = 0;
  for (let k = 0; k < P.length - 1; k++) { const L = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); segs.push(L); total += L; }
  ctx.fillStyle = COLORS.force;
  for (let d = dotPhase; d < total; d += SP) {
    let t = d, k = 0; while (k < segs.length - 1 && t > segs[k]) { t -= segs[k]; k++; }
    const [ax, ay] = P[k], [bx, by] = P[k + 1], f = segs[k] ? t / segs[k] : 0;
    ctx.beginPath(); ctx.arc(ax + (bx - ax) * f, ay + (by - ay) * f, 3.4, 0, Math.PI * 2); ctx.fill();
  }
}

// Bombillo que reemplaza a la batería durante la descarga: brilla según la corriente que pasa
function drawBulb(ctx, x, y) {
  const b = clamp(flowG, 0, 1);
  if (b > 0.02) { const g = ctx.createRadialGradient(x, y, 4, x, y, 74); g.addColorStop(0, `rgba(253,224,71,${0.6 * b})`); g.addColorStop(1, 'rgba(253,224,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 74, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x, y - 16); ctx.moveTo(x, y + 16); ctx.lineTo(x, y + 22); ctx.stroke();
  ctx.fillStyle = '#1b2347'; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(253,224,71,${0.9 * b})`; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8b95c9'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = b > 0.1 ? '#fffbe0' : '#8b95c9'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(x - 9, y + 4); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x, y + 4); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x + 9, y + 4); ctx.stroke();
}

// =============== Vista 1: capacitor de placas ===============
function drawPlates(ctx, e) {
  const r = pr, k = diel();
  const W = clamp(140 + 200 * Math.sqrt(S.A / 200), 140, e.w * 0.5), gap = 30 + 12 * S.d;
  const cx = e.w * 0.52, cy = e.h * 0.46, x0 = cx - W / 2, x1 = cx + W / 2, top = cy - gap / 2 - 10, bot = cy + gap / 2;
  const xs = x1 - (S.x / 100) * W;                                   // el dieléctrico entra por la derecha

  // dieléctrico
  if (S.x > 0 && k.color) {
    ctx.fillStyle = k.color + '88'; ctx.fillRect(xs, top + 10, x1 - xs, gap);
    ctx.strokeStyle = k.color; ctx.lineWidth = 2; ctx.strokeRect(xs, top + 10, x1 - xs, gap);
    if (x1 - xs > 70) label(ctx, `κ = ${k.kappa}`, (xs + x1) / 2, cy + 5, { size: 12 });
  }

  // densidad de cargas y de líneas de campo según σ = ε₀E (escala logarítmica, solo visual)
  const sigma = EPS0 * (qd / r.C / r.d), idx = clamp((Math.log10(Math.max(sigma, 1e-12)) + 9.5) / 3, 0.1, 1);
  const spAir = 60 - 48 * idx, spD = Math.max(7, spAir / Math.sqrt(k.kappa));
  const signs = (y, ch, col) => {
    ctx.fillStyle = col; ctx.font = '700 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let x = x0 + spAir / 2; x < xs; x += spAir) ctx.fillText(ch, x, y);
    for (let x = xs + spD / 2; x < x1; x += spD) ctx.fillText(ch, x, y);
  };
  signs(top - 12, '+', COLORS.pos); signs(bot + 22, '−', COLORS.neg);

  // líneas de campo (de + a −): siempre E = V/d, uniforme entre las placas
  ctx.strokeStyle = COLORS.force; ctx.fillStyle = COLORS.force; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85;
  for (let x = x0 + spAir * 0.65; x < x1; x += spAir * 1.3) {
    const y1 = top + 14, y2 = bot - 3; if (y2 - y1 < 8) break;
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2 - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y2); ctx.lineTo(x - 4, y2 - 8); ctx.lineTo(x + 4, y2 - 8); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // placas
  ctx.fillStyle = '#ff8d85'; ctx.fillRect(x0, top, W, 10);
  ctx.fillStyle = '#7fd0f5'; ctx.fillRect(x0, bot, W, 10);

  // batería + cables + interruptor
  const bx = Math.max(46, x0 - 120), ys = top + 5, yb = bot + 5;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(bx, cy - 22); ctx.lineTo(bx, ys);
  const sw = (bx + x0) / 2;
  if (S.conn || disch) ctx.lineTo(x0, ys);
  else { ctx.lineTo(sw - 18, ys); ctx.moveTo(sw + 18, ys); ctx.lineTo(x0, ys); }
  ctx.moveTo(bx, cy + 22); ctx.lineTo(bx, yb); ctx.lineTo(x0, yb); ctx.stroke();
  if (!S.conn) { ctx.strokeStyle = '#e8ecff'; ctx.beginPath(); ctx.moveTo(sw - 18, ys); ctx.lineTo(sw + 12, ys - 18); ctx.stroke(); }
  if (disch) drawBulb(ctx, bx, cy);
  else {
  ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx, cy - 22); ctx.lineTo(bx, cy - 6); ctx.moveTo(bx, cy + 6); ctx.lineTo(bx, cy + 22); ctx.stroke();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 20, cy - 6); ctx.lineTo(bx + 20, cy - 6); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(bx - 10, cy + 6); ctx.lineTo(bx + 10, cy + 6); ctx.stroke();
  label(ctx, '+', bx + 30, cy - 10, { color: COLORS.pos, size: 16 }); label(ctx, '−', bx + 30, cy + 12, { color: COLORS.neg, size: 16 });
  label(ctx, S.conn ? `${S.V} V` : 'desconectada', bx - 28, cy, { align: 'right', size: 14, color: S.conn ? COLORS.text : COLORS.textDim });
  }

  // puntitos de corriente: hacia las placas al cargar, de vuelta al descargar
  if (flow !== 0) { drawDots(ctx, [[bx, cy - 22], [bx, ys], [x0, ys]], flow < 0); drawDots(ctx, [[x0, yb], [bx, yb], [bx, cy + 22]], flow < 0); }

  // etiquetas
  label(ctx, `+Q = ${si(qd, 'C')}`, cx, top - 36, { size: 13, color: COLORS.pos });
  label(ctx, `−Q = ${si(qd, 'C')}`, cx, bot + 48, { size: 13, color: COLORS.neg });
  if (disch) {
    label(ctx, 'Descargando por un bombillo (cámara lenta)', cx, top - 62, { size: 11, color: COLORS.textDim });
    label(ctx, `energía disipada: ${si(Math.max(0, (disch.Q0 ** 2 - qd ** 2) / (2 * r.C)), 'J')}`, bx, cy + 40, { size: 11, color: COLORS.force });
  }
  const xd = x1 + 22;
  ctx.strokeStyle = COLORS.textDim; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(xd, top + 10); ctx.lineTo(xd, bot); ctx.moveTo(xd - 5, top + 10); ctx.lineTo(xd + 5, top + 10); ctx.moveTo(xd - 5, bot); ctx.lineTo(xd + 5, bot); ctx.stroke();
  label(ctx, `d = ${S.d} mm`, xd + 10, cy - 12, { align: 'left', size: 12 });
  label(ctx, `V = ${si(qd / r.C, 'V')}`, xd + 10, cy + 6, { align: 'left', size: 12, color: COLORS.force });
  label(ctx, `E = ${si(qd / r.C / r.d, 'V/m')}`, xd + 10, cy + 24, { align: 'left', size: 12, color: COLORS.force });
}

// =============== Vista 2: combinaciones ===============
function comboLayout(w, h) {
  const x0 = 70, x1 = Math.max(x0 + 170, w - 150), y0 = 110, y1 = h - 110, ym = (y0 + y1) / 2, bt = 22;
  const up = [x0, ym - bt], dn = [x0, ym + bt], mid = (x0 + x1) / 2;
  if (S.mode === 'serie') {
    return { x0, ym, bt, wires: [[up, [x0, y0], [x1, y0], [x1, y1], [x0, y1], dn]],
      el: [{ i: 0, x: mid, y: y0, vert: false, pf: true }, { i: 1, x: x1, y: ym, vert: true, pf: true }, { i: 2, x: mid, y: y1, vert: false, pf: false }] };
  }
  if (S.mode === 'paralelo') {
    const xa = x0 + (x1 - x0) / 3, xb = x0 + (2 * (x1 - x0)) / 3, xc = x1;
    return { x0, ym, bt, wires: [[up, [x0, y0], [xc, y0]], [dn, [x0, y1], [xc, y1]], [[xa, y0], [xa, y1]], [[xb, y0], [xb, y1]], [[xc, y0], [xc, y1]]],
      el: [xa, xb, xc].map((x, i) => ({ i, x, y: ym, vert: true, pf: true })) };
  }
  const xb = mid;
  return { x0, ym, bt, wires: [[up, [x0, y0], [x1, y0]], [dn, [x0, y1], [x1, y1]], [[xb, y0], [xb, y1]], [[x1, y0], [x1, y1]]],
    el: [{ i: 0, x: (x0 + xb) / 2, y: y0, vert: false, pf: true }, { i: 1, x: xb, y: ym, vert: true, pf: true }, { i: 2, x: x1, y: ym, vert: true, pf: true }] };
}

function drawCap(ctx, el, item, qmax, qdisp) {
  const a = 0.35 + 0.65 * (qmax > 0 ? qdisp / qmax : 0);
  const red = `rgba(255,90,78,${a})`, blue = `rgba(56,189,248,${a})`;
  const [c1, c2] = el.pf ? [red, blue] : [blue, red];
  ctx.lineCap = 'round';
  if (!el.vert) {
    ctx.strokeStyle = COLORS.stage; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(el.x - 15, el.y); ctx.lineTo(el.x + 15, el.y); ctx.stroke();
    ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(el.x - 15, el.y); ctx.lineTo(el.x - 6, el.y); ctx.moveTo(el.x + 6, el.y); ctx.lineTo(el.x + 15, el.y); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(el.x - 6, el.y - 17); ctx.lineTo(el.x - 6, el.y + 17); ctx.stroke();
    ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(el.x + 6, el.y - 17); ctx.lineTo(el.x + 6, el.y + 17); ctx.stroke();
  } else {
    ctx.strokeStyle = COLORS.stage; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(el.x, el.y - 15); ctx.lineTo(el.x, el.y + 15); ctx.stroke();
    ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(el.x, el.y - 15); ctx.lineTo(el.x, el.y - 6); ctx.moveTo(el.x, el.y + 6); ctx.lineTo(el.x, el.y + 15); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = c1; ctx.beginPath(); ctx.moveTo(el.x - 17, el.y - 6); ctx.lineTo(el.x + 17, el.y - 6); ctx.stroke();
    ctx.strokeStyle = c2; ctx.beginPath(); ctx.moveTo(el.x - 17, el.y + 6); ctx.lineTo(el.x + 17, el.y + 6); ctx.stroke();
  }
  const name = `C${SUB[el.i]} = ${S.C[el.i]} µF`, meas = `${si(item.Q, 'C')} · ${fmt(item.V)} V`;
  if (el.vert) { label(ctx, name, el.x + 30, el.y - 9, { align: 'left', size: 12 }); label(ctx, meas, el.x + 30, el.y + 9, { align: 'left', size: 12, color: COLORS.force }); }
  else { label(ctx, name, el.x, el.y - 36, { size: 12 }); label(ctx, meas, el.x, el.y + 38, { size: 12, color: COLORS.force }); }
}

function drawCombo(ctx, e) {
  const L = comboLayout(e.w, e.h), qmax = Math.max(...cr.items.map((i) => i.Q));
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = WIRE; ctx.lineWidth = 4;
  L.wires.forEach((w) => { ctx.beginPath(); w.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); });
  // la 2.ª polilínea (riel inferior) está dibujada de izquierda a derecha, pero la corriente de carga va al revés
  if (flow !== 0) L.wires.forEach((w, i) => drawDots(ctx, w, (flow < 0) !== (S.mode !== 'serie' && i === 1)));
  const { x0, ym, bt } = L;                                        // batería
  ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, ym - bt); ctx.lineTo(x0, ym - 8); ctx.moveTo(x0, ym + 8); ctx.lineTo(x0, ym + bt); ctx.stroke();
  ctx.strokeStyle = COLORS.stage; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, ym - bt + 6); ctx.lineTo(x0, ym + bt - 6); ctx.stroke();
  ctx.strokeStyle = WIRE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, ym - bt); ctx.lineTo(x0, ym - 8); ctx.moveTo(x0, ym + 8); ctx.lineTo(x0, ym + bt); ctx.stroke();
  ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 20, ym - 8); ctx.lineTo(x0 + 20, ym - 8); ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x0 - 10, ym + 8); ctx.lineTo(x0 + 10, ym + 8); ctx.stroke();
  label(ctx, '+', x0 + 30, ym - 12, { color: COLORS.pos, size: 16 }); label(ctx, '−', x0 + 30, ym + 13, { color: COLORS.neg, size: 16 });
  label(ctx, `${S.Vc} V`, x0 - 30, ym, { align: 'right', size: 16 });
  L.el.forEach((el) => drawCap(ctx, el, cr.items[el.i], qmax, cd[el.i]));
  label(ctx, 'Placa roja = carga +, placa azul = carga −. Más intensa = más carga almacenada.', e.w / 2, e.h - 22, { color: COLORS.textDim, size: 11 });
}

const sim = new SimCanvas($('stage'), {
  scale: 1,
  update(dt) {
    if (disch) {   // descarga por el bombillo: Q(t) = Q₀·e^(−t/τ)  (τ visual ≈ 1 s)
      disch.t += dt; S.Qfix = disch.Q0 * Math.exp(-disch.t / 1.1);
      if (S.Qfix < disch.Q0 * 0.003) { S.Qfix = 0; disch = null; }
      dirty = true;
    }
    if (dirty) { pr = plateIn(); cr = caps(); refresh(); dirty = false; }
    const k = 1 - Math.exp(-dt / 0.45);          // la carga mostrada persigue a la final (como un RC real, en cámara lenta)
    let g = 0;
    if (S.view === 'placas') {
      const gap = pr.Q - qd;
      if (S.conn) { qd += gap * k; g = Math.abs(gap) / Math.max(Math.abs(pr.Q), Math.abs(qd), 1e-15); flow = Math.sign(gap) * 170 * g; }
      else { qd = pr.Q; if (disch) { g = Math.min(1, qd / disch.Q0); flow = -170 * g; } else flow = 0; }
    } else {
      let sum = 0;
      cr.items.forEach((it, i) => { const gap = it.Q - cd[i]; cd[i] += gap * k; sum += gap; g = Math.max(g, Math.abs(gap) / Math.max(it.Q, cd[i], 1e-15)); });
      flow = Math.sign(sum) * 170 * g;
    }
    flowG = g; if (Math.abs(flow) < 8) flow = 0;
    dotPhase = (dotPhase + Math.abs(flow) * dt) % SP;
  },
  draw(ctx, e) {
    ctx.fillStyle = COLORS.stage; ctx.fillRect(0, 0, e.w, e.h);
    if (!pr) return;
    S.view === 'placas' ? drawPlates(ctx, e) : drawCombo(ctx, e);
  },
});

// =============== Panel ===============
function refresh() {
  if (S.view === 'placas') {
    const r = pr, k = diel(), x = S.x / 100;
    $('pC').textContent = si(r.C, 'F'); $('pQ').textContent = si(r.Q, 'C'); $('pV').textContent = si(r.V, 'V');
    $('pE').textContent = si(r.E, 'V/m'); $('pU').textContent = si(r.U, 'J');
    $('pRatio').textContent = `×${fmt(r.C / r.C0)}`;
    $('pFormula').textContent =
      `C = ε₀·A/d · [1 + (κ−1)·x]\n  = (${fmt(EPS0)})(${fmt(r.A)})/(${fmt(r.d)}) · [1 + (${k.kappa}−1)(${fmt(x)})]\n  = ${si(r.C, 'F')}\n` +
      (S.conn ? `V = ${S.V} V  (batería conectada)\nQ = C·V = ${si(r.Q, 'C')}\n` : `Q = ${si(r.Q, 'C')}  (fija: batería desconectada)\nV = Q / C = ${si(r.V, 'V')}\n`) +
      `E = V / d = ${si(r.E, 'V/m')}\nU = ½·C·V² = ${si(r.U, 'J')}`;
    $('pConn').textContent = S.conn ? 'Desconectar la batería' : 'Conectar la batería';
    $('pStatus').textContent = disch ? 'Descargando por el bombillo: la energía almacenada se convierte en luz y calor.' : S.conn ? 'Batería conectada: V se mantiene fijo y Q cambia.' : 'Batería desconectada: Q se mantiene fija y V cambia.';
    $('V').disabled = !S.conn;
  } else {
    const r = cr, n = (i) => `C${SUB[i]}`, C = S.C;
    $('cEq').textContent = si(r.Ceq, 'F'); $('cQ').textContent = si(r.Q, 'C'); $('cU').textContent = si(r.U, 'J');
    $('cTbl').innerHTML = `<table class="tbl"><tr><th></th><th>C</th><th>Q</th><th>V</th><th>U</th></tr>` +
      r.items.map((x, i) => `<tr><td>${n(i)}</td><td>${C[i]} µF</td><td>${si(x.Q, 'C')}</td><td>${fmt(x.V)} V</td><td>${si(x.U, 'J')}</td></tr>`).join('') + `</table>`;
    const sumV = r.items.reduce((s, x) => s + x.V, 0), sumU = r.items.reduce((s, x) => s + x.U, 0);
    let t;
    if (S.mode === 'serie') {
      t = `1/C_eq = 1/C₁ + 1/C₂ + 1/C₃\nC_eq = ${si(r.Ceq, 'F')}\nQ = C_eq·V = ${si(r.Q, 'C')}   (la misma en todos)\nVᵢ = Q / Cᵢ:\n${r.items.map((x, i) => `  V${SUB[i]} = ${fmt(x.V)} V`).join('\n')}\nΣVᵢ = ${fmt(sumV)} V = V ✔`;
    } else if (S.mode === 'paralelo') {
      t = `C_eq = C₁ + C₂ + C₃ = ${si(r.Ceq, 'F')}\nMismo voltaje: V = ${S.Vc} V\nQᵢ = Cᵢ·V:\n${r.items.map((x, i) => `  Q${SUB[i]} = ${si(x.Q, 'C')}`).join('\n')}\nQ = ΣQᵢ = ${si(r.Q, 'C')}`;
    } else {
      t = `C₂₃ = C₂ + C₃ = ${si(r.C23, 'F')}   (paralelo)\n1/C_eq = 1/C₁ + 1/C₂₃\nC_eq = ${si(r.Ceq, 'F')}\nQ = C_eq·V = ${si(r.Q, 'C')}   (= Q₁)\nV₁ = Q/C₁ = ${fmt(r.items[0].V)} V\nV₂₃ = Q/C₂₃ = ${fmt(r.V23)} V\nQ₂ = C₂·V₂₃ = ${si(r.items[1].Q, 'C')}\nQ₃ = C₃·V₂₃ = ${si(r.items[2].Q, 'C')}`;
    }
    $('cFormula').textContent = t + `\nU = ½·C_eq·V² = ${si(r.U, 'J')} = ΣUᵢ ${Math.abs(sumU - r.U) < 1e-12 * Math.max(1, r.U) ? '✔' : ''}`;
  }
}

function syncControls() {
  $('A').value = S.A; $('Av').textContent = `${S.A} cm²`;
  $('d').value = S.d; $('dv').textContent = `${S.d} mm`;
  $('V').value = S.V; $('Vv').textContent = `${S.V} V`;
  $('diel').value = S.diel;
  $('x').value = S.x; $('xv').textContent = `${S.x} %`;
  $('Vc').value = S.Vc; $('Vcv').textContent = `${S.Vc} V`;
  [1, 2, 3].forEach((n) => { $(`c${n}`).value = S.C[n - 1]; $(`c${n}v`).textContent = `${S.C[n - 1]} µF`; });
  [['serie', 'mSerie'], ['paralelo', 'mPar'], ['combinado', 'mComb']].forEach(([m, id]) => { $(id).className = S.mode === m ? 'btn' : 'btn ghost'; });
  $('tabP').className = S.view === 'placas' ? 'btn' : 'btn ghost'; $('tabC').className = S.view === 'combo' ? 'btn' : 'btn ghost';
  $('v1').hidden = S.view !== 'placas'; $('v2').hidden = S.view !== 'combo';
}
const touch = () => { syncControls(); dirty = true; };

$('diel').innerHTML = DIELECTRICS.map((m) => `<option value="${m.id}">${m.name} (κ = ${m.kappa})</option>`).join('');
[['A', 'A'], ['d', 'd'], ['V', 'V'], ['x', 'x'], ['Vc', 'Vc']].forEach(([id, k]) => $(id).addEventListener('input', () => { S[k] = parseFloat($(id).value); touch(); }));
[1, 2, 3].forEach((n) => $(`c${n}`).addEventListener('input', () => { S.C[n - 1] = parseFloat($(`c${n}`).value); touch(); }));
$('diel').addEventListener('change', () => { S.diel = $('diel').value; if (S.diel === 'aire') S.x = 0; touch(); });
$('pConn').addEventListener('click', () => { if (S.conn) { S.Qfix = qd; S.conn = false; } else { S.conn = true; disch = null; } touch(); });
$('pDis').addEventListener('click', () => { if (disch || qd < 1e-15) return; S.Qfix = qd; S.conn = false; disch = { Q0: qd, t: 0 }; touch(); });
$('tabP').addEventListener('click', () => { S.view = 'placas'; touch(); });
$('tabC').addEventListener('click', () => { S.view = 'combo'; touch(); });
[['serie', 'mSerie'], ['paralelo', 'mPar'], ['combinado', 'mComb']].forEach(([m, id]) => $(id).addEventListener('click', () => { S.mode = m; touch(); }));
$('pEx').addEventListener('click', () => { disch = null; Object.assign(S, { A: 100, d: 1, V: 12, diel: 'aire', x: 0, conn: true }); touch();
  $('pHint').textContent = 'Calcula C = ε₀A/d con A = 0,01 m² y d = 1 mm (≈ 88,5 pF), luego Q = CV y U = ½CV². Después desconecta la batería y mete el vidrio por completo (x = 100 %): ¿qué le pasa a V? Vuelve a conectar y repite: ¿ahora qué cambia?'; });
$('cEx').addEventListener('click', () => { S.Vc = 12; S.C = S.mode === 'combinado' ? [20, 20, 40] : [10, 20, 60]; touch();
  $('cHint').textContent = { serie: 'Resultado esperado: C_eq = 6 µF, Q = 72 µC, V = 7,2 · 3,6 · 1,2 V.', paralelo: 'Resultado esperado: C_eq = 90 µF y Q = 120 · 240 · 720 µC.', combinado: 'Resultado esperado: C₂₃ = 60 µF, C_eq = 15 µF, Q = 180 µC, V₁ = 9 V y V₂₃ = 3 V.' }[S.mode]; });

syncControls();
sim.start();
})();
