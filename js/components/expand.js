// Botón «Expandir»: muestra la simulación a pantalla completa (la misma, sigue interactiva).
// Los resultados (.readout) pasan a una barra sobre el recuadro, como en el bosquejo.
(function () {
  const layout = document.querySelector('.sim-layout'), stage = layout && layout.querySelector('.stage');
  if (!stage) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'expand-btn';
  stage.appendChild(btn);
  let moved = [], hud = null;
  const label = (on) => { btn.textContent = on ? '✕ Salir' : '⛶ Expandir'; btn.setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Expandir simulación a pantalla completa'); btn.setAttribute('aria-pressed', on); };
  label(false);
  function set(on) {
    if (on === layout.classList.contains('is-expanded')) return;
    layout.classList.toggle('is-expanded', on);
    document.documentElement.classList.toggle('has-expanded', on);
    if (on) {
      hud = document.createElement('div'); hud.className = 'stage-hud'; stage.appendChild(hud);
      layout.querySelectorAll('.readout').forEach((el) => { moved.push({ el, parent: el.parentNode, next: el.nextSibling }); hud.appendChild(el); });
      try { const p = layout.requestFullscreen && layout.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    } else {
      moved.reverse().forEach(({ el, parent, next }) => parent.insertBefore(el, next)); moved = [];
      if (hud) { hud.remove(); hud = null; }
      if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    }
    label(on); window.dispatchEvent(new Event('resize')); btn.focus();
  }
  btn.addEventListener('click', () => set(!layout.classList.contains('is-expanded')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) set(false); });
})();
