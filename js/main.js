(function () {
'use strict';
const CA = (window.CA = window.CA || {});
const { mountNavbar } = CA;
const { SIMS, UNITS, simUrl } = CA;
// Se usa en Inicio y Ayuda: monta la navbar y, si existe #sim-grid, dibuja las tarjetas.

mountNavbar();

const grid = document.getElementById('sim-grid');
if (grid) {
  grid.innerHTML = Object.entries(UNITS).map(([u, info]) => `
    <section class="unit-block">
      <h2><i class="dot" style="--c:${info.color};display:inline-block"></i>${info.name}</h2>
      <div class="sim-grid">
        ${SIMS.filter((s) => s.unit === Number(u)).map((s) => {
          const inner = `<span class="ico">${s.icon}</span><h3>${s.title}</h3><p>${s.desc}</p>`;
          return s.ready
            ? `<a class="sim-card" style="--c:${info.color}" href="${simUrl(s, './')}">${inner}</a>`
            : `<div class="sim-card soon" style="--c:${info.color}">${inner}</div>`;
        }).join('')}
      </div>
    </section>`).join('');
}
})();
