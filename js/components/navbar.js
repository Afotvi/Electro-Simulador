// Barra de navegación: Inicio · Simulaciones · Ayuda. Cada página define <body data-root data-page="inicio|sim|ayuda">.
(function () {
  const CA = (window.CA = window.CA || {});
  function mountNavbar() {
    const root = document.body.dataset.root ?? './', page = document.body.dataset.page ?? '';
    const link = (href, key, txt) =>
      `<a class="nav-link ${page === key ? 'active' : ''}" href="${root}${href}"${page === key ? ' aria-current="page"' : ''}>${txt}</a>`;
    const nav = document.createElement('header');
    nav.className = 'nav';
    nav.innerHTML = `<a class="brand" href="${root}index.html"><i class="brand-mark"></i><span class="name">Electro-simulador</span></a>
      <nav class="nav-links" aria-label="Principal">${link('index.html', 'inicio', 'Inicio')}${link('simulaciones.html', 'sim', 'Simulaciones')}${link('ayuda.html', 'ayuda', 'Ayuda')}</nav>`;
    document.body.prepend(nav);
  }
  Object.assign(CA, { mountNavbar });
})();
