// Catálogo de simulaciones organizado por tema (la unidad es solo una etiqueta pequeña).
(function () {
  const { SIMS, UNITS, simUrl, mountNavbar } = window.CA;
  mountNavbar();
  const TOPICS = [['fuerzas', 'Cargas y fuerzas'], ['campos', 'Campos eléctricos'], ['energia', 'Energía y potencial'], ['circuitos', 'Corriente y circuitos'], ['magnetismo', 'Magnetismo']];
  const META = {
    coulomb: ['fuerzas', 'Básico', null], 'campo-electrico': ['campos', 'Básico', 'coulomb'], gauss: ['campos', 'Intermedio', 'campo-electrico'],
    potencial: ['energia', 'Intermedio', 'campo-electrico'], capacitores: ['energia', 'Intermedio', 'potencial'],
    resistencia: ['circuitos', 'Básico', null], ohm: ['circuitos', 'Básico', 'resistencia'], kirchhoff: ['circuitos', 'Intermedio', 'ohm'],
    lorentz: ['magnetismo', 'Intermedio', null], 'biot-savart': ['magnetismo', 'Intermedio', 'lorentz'], ampere: ['magnetismo', 'Intermedio', 'biot-savart'], faraday: ['magnetismo', 'Avanzado', 'ampere'],
  };
  const title = (id) => SIMS.find((s) => s.id === id).title;
  const host = document.getElementById('catalog'), chips = document.getElementById('chips');
  let current = 'todos';

  const card = (s) => {
    const [, nivel, req] = META[s.id], u = UNITS[s.unit], c = u.color, unit = u.name.split(' · ')[1];
    const inner = `<span class="ico" aria-hidden="true">${s.icon}</span><h3>${s.title}</h3><p>${s.desc}</p>
      <div class="meta"><span class="tag">${nivel}</span><span class="tag ghost">${unit}</span></div>
      ${req ? `<small class="req">Antes: ${title(req)}</small>` : ''}`;
    return s.ready ? `<a class="sim-card" style="--c:${c}" href="${simUrl(s, './')}">${inner}</a>`
      : `<div class="sim-card soon" style="--c:${c}">${inner}<small class="req">Próximamente</small></div>`;
  };
  function render() {
    host.innerHTML = TOPICS.filter(([k]) => current === 'todos' || current === k).map(([k, name]) => {
      const list = SIMS.filter((s) => META[s.id][0] === k);
      return list.length ? `<section class="unit-block"><h2>${name}</h2><div class="sim-grid">${list.map(card).join('')}</div></section>` : '';
    }).join('');
    chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === current));
  }
  chips.innerHTML = [['todos', 'Todas'], ...TOPICS].map(([k, n]) => `<button type="button" class="chipbtn" data-k="${k}">${n}</button>`).join('');
  chips.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { current = b.dataset.k; render(); } });
  render();
})();
