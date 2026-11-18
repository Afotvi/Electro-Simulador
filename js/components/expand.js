// Resultados dentro del recuadro + botón «Expandir» (pantalla completa).
// Los .readout se mueven a una barra (.stage-hud) DEBAJO del canvas y el botón va en una barra (.stage-bar) ENCIMA:
// así ocupan su propia fila y nunca tapan la simulación.
(function () {
  const layout = document.querySelector('.sim-layout'), stage = layout && layout.querySelector('.stage');
  if (!stage) return;

  // 1) Resultados dentro del recuadro
  const hud = document.createElement('div');
  hud.className = 'stage-hud';
  hud.setAttribute('aria-label', 'Resultados de la simulación');
  const moved = [];
  layout.querySelectorAll('.readout').forEach((el) => {
    const parent = el.parentNode, h = el.previousElementSibling;
    if (h && /^H[1-6]$/.test(h.tagName)) h.hidden = true; // el título «Resultados» queda sin contenido en el panel
    moved.push({ el, parent });
    hud.appendChild(el);
  });
  if (moved.length) stage.appendChild(hud);
  // Si un resultado pertenecía a una vista oculta (p. ej. otra pestaña), sigue oculto
  const sync = () => moved.forEach(({ el, parent }) => { el.style.display = parent.closest('[hidden]') ? 'none' : ''; });
  new MutationObserver(sync).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
  sync();

  // 2) Pantalla completa
  const bar = document.createElement('div');
  bar.className = 'stage-bar';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'expand-btn';
  bar.appendChild(btn);
  stage.insertBefore(bar, stage.firstChild);
  const label = (on) => { btn.textContent = on ? '✕ Salir' : '⛶ Expandir'; btn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Expandir simulación a pantalla completa'); btn.setAttribute('aria-pressed', on); };
  label(false);
  function set(on) {
    if (on === layout.classList.contains('is-expanded')) return;
    layout.classList.toggle('is-expanded', on);
    document.documentElement.classList.toggle('has-expanded', on);
    if (on) { try { const p = layout.requestFullscreen && layout.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
    else if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    label(on); window.dispatchEvent(new Event('resize')); btn.focus();
  }
  btn.addEventListener('click', () => set(!layout.classList.contains('is-expanded')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) set(false); });
})();
