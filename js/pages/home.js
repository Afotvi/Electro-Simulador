// Inicio: campo eléctrico vivo en la portada + línea de progreso de la ruta de aprendizaje.
(function () {
  const { SimCanvas, chargeDot, fieldAt, traceLine, COLORS, mountNavbar } = window.CA;
  mountNavbar();
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.getElementById('hero-canvas');
  if (cv) {
    const fixed = { x: -0.9, y: 0, q: 2 }, mover = { x: 0.9, y: 0.3, q: -2 };
    let auto = !calm;
    const sign = document.getElementById('hero-sign');
    const toggle = () => { mover.q = -mover.q; sign.textContent = mover.q > 0 ? 'positiva (roja)' : 'negativa (azul)'; };
    document.getElementById('hero-flip').addEventListener('click', toggle);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    new SimCanvas(cv, {
      scale: 105,
      update(dt, e) { if (auto) { mover.x = 0.9 * Math.cos(e.time * 0.45); mover.y = 0.75 * Math.sin(e.time * 0.7); } },
      onDown(p) { auto = false; toggle(); },
      onMove(p, e) { auto = false; const b = e.bounds; mover.x = clamp(p.x, b.xmin + 0.1, b.xmax - 0.1); mover.y = clamp(p.y, b.ymin + 0.1, b.ymax - 0.1); },
      draw(ctx, e) {
        const ch = [fixed, mover], pos = ch.filter((c) => c.q > 0), src = pos.length ? pos : ch, dir = pos.length ? 1 : -1;
        ctx.strokeStyle = 'rgba(167,139,250,.8)'; ctx.lineWidth = 1.5;
        for (const c of src) for (let k = 0; k < 14; k++) {
          const a = (2 * Math.PI * k) / 14 + 0.05;
          const pts = traceLine(ch, c.x + 0.09 * Math.cos(a), c.y + 0.09 * Math.sin(a), dir, e.bounds, { ds: 0.04, maxSteps: 500 });
          ctx.beginPath(); pts.forEach((q, i) => { const s = e.toScreen(q.x, q.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke();
        }
        ch.forEach((c) => { const s = e.toScreen(c.x, c.y); chargeDot(ctx, s.x, s.y, c.q > 0 ? 1 : -1, 16); });
      },
    }).start();
    cv.addEventListener('pointerleave', () => { auto = !calm; });
  }
  const route = document.getElementById('route');
  if (route) {
    const items = [...route.querySelectorAll('li')];
    const upd = () => {
      const r = route.getBoundingClientRect();
      const p = calm ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.75 - r.top) / r.height));
      route.style.setProperty('--p', p);
      items.forEach((li, i) => li.classList.toggle('on', (i + 0.5) / items.length <= p + 0.02));
    };
    addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
  }
})();
