// Guía didáctica común: se genera desde el JSON #didactic-data de cada simulación.
(function () {
  const dataEl = document.getElementById('didactic-data'), host = document.getElementById('didactic');
  if (!dataEl || !host) return;
  const D = JSON.parse(dataEl.textContent);
  const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const sup = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const parse = (s) => parseFloat(s.replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => sup[c]).replace(/\s/g, '').replace(/[x×]10\^?/i, 'e').replace(',', '.'));
  const setSliders = (set) => Object.entries(set).forEach(([id, v]) => {
    const s = document.getElementById(id); if (!s) return;
    s.value = v; s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const block = (title) => { const s = h('section', 'dz-block'); s.appendChild(h('h2', '', title)); host.appendChild(s); return s; };

  if (D.idea) { const s = h('p', 'dz-idea', `<b>Idea clave.</b> ${D.idea}`); host.appendChild(s); }
  if (D.observe) { const s = block('Qué observar'); s.appendChild(h('ul', 'dz-list', D.observe.map((t) => `<li>${t}</li>`).join(''))); }

  (D.predict || []).forEach((p, i) => {
    const s = block(i === 0 ? 'Predice y comprueba' : 'Otra predicción');
    s.appendChild(h('p', '', p.q));
    const opts = h('div', 'dz-opts'), out = h('div', 'dz-out'); out.setAttribute('aria-live', 'polite');
    p.options.forEach((o, k) => {
      const b = h('button', 'btn ghost', o); b.type = 'button';
      b.addEventListener('click', () => {
        const ok = k === p.correct;
        opts.querySelectorAll('button').forEach((x) => x.classList.remove('good', 'bad'));
        b.classList.add(ok ? 'good' : 'bad');
        out.innerHTML = `<b>${ok ? 'Correcto.' : 'Todavía no.'}</b> ${p.why}`;
        if (p.try && !out.querySelector('button')) {
          const t = h('button', 'btn', p.try.label); t.type = 'button';
          t.addEventListener('click', () => setSliders(p.try.set)); out.appendChild(h('div', '')).appendChild(t);
        }
      });
      opts.appendChild(b);
    });
    s.append(opts, out);
  });

  if (D.steps) {
    const s = block('Ejercicio guiado'); if (D.stepsIntro) s.appendChild(h('p', 'hint', D.stepsIntro));
    D.steps.forEach((st, i) => {
      const row = h('div', 'dz-step', `<label>${i + 1}. ${st.q}</label>`);
      const inp = h('input'); inp.type = 'text'; inp.inputMode = 'decimal'; inp.placeholder = st.unit || ''; inp.setAttribute('aria-label', st.q);
      const b = h('button', 'btn', 'Verificar'); b.type = 'button';
      const fb = h('div', 'dz-out'); fb.setAttribute('aria-live', 'polite');
      b.addEventListener('click', () => {
        const v = parse(inp.value);
        if (Number.isNaN(v)) { fb.innerHTML = 'Escribe un número (puedes usar 1,5 o 1,5×10⁻¹¹).'; return; }
        const ok = Math.abs(v - st.answer) <= Math.abs(st.answer) * (st.tol || 0.03);
        fb.innerHTML = ok ? `<b>Bien.</b> ${st.sol}` : `<b>No coincide.</b> Pista: ${st.hint}`;
      });
      const line = h('div', 'dz-line'); line.append(inp, h('span', 'dz-unit', st.unit || ''), b);
      row.append(line, fb); s.appendChild(row);
    });
  }

  if (D.challenges) {
    const s = block('¿Y si…?'); const box = h('div', 'dz-opts');
    D.challenges.forEach((c) => {
      const b = h('button', 'btn ghost', c.label); b.type = 'button';
      b.addEventListener('click', () => { setSliders(c.set); out.innerHTML = c.note; });
      box.appendChild(b);
    });
    const out = h('div', 'dz-out'); out.setAttribute('aria-live', 'polite'); s.append(box, out);
  }
  if (D.mistakes) { const s = block('Errores comunes'); s.appendChild(h('ul', 'dz-list', D.mistakes.map((t) => `<li>${t}</li>`).join(''))); }
  if (D.glossary) {
    const s = block('Glosario');
    s.appendChild(h('dl', 'dz-gloss', Object.entries(D.glossary).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')));
  }
})();
