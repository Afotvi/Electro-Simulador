// Añade una entrada numérica junto a cada deslizador (sincronizadas en ambos sentidos).
(function () {
  const ranges = [...document.querySelectorAll('.ctrl input[type=range]')];
  ranges.forEach((r) => {
    const w = document.createElement('div'); w.className = 'rowin';
    r.parentNode.insertBefore(w, r); w.appendChild(r);
    const n = document.createElement('input'); n.type = 'number'; n.className = 'num';
    ['min', 'max', 'step'].forEach((a) => n.setAttribute(a, r.getAttribute(a)));
    const lb = r.closest('.ctrl').querySelector('label');
    n.setAttribute('aria-label', (lb ? lb.firstChild.textContent.trim() : 'Valor') + ' (valor exacto)');
    n.value = r.value; w.appendChild(n); r._num = n;
    const push = () => {
      let v = parseFloat(n.value); if (Number.isNaN(v)) return;
      r.value = Math.min(+r.max, Math.max(+r.min, v));
      r.dispatchEvent(new Event('input', { bubbles: true }));
    };
    n.addEventListener('input', push);
    n.addEventListener('change', () => { push(); n.value = r.value; });
  });
  (function tick() {
    ranges.forEach((r) => { r._num.disabled = r.disabled; if (document.activeElement !== r._num && r._num.value !== r.value) r._num.value = r.value; });
    requestAnimationFrame(tick);
  })();
})();
