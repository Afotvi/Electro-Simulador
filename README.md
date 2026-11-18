# Electro-simulador

Laboratorio virtual de electromagnetismo (HTML, CSS y JavaScript puro).

## Cómo abrirlo
Doble clic en `index.html`, o en VS Code: clic derecho > Open with Live Server (opcional).
Funciona sin servidor ni internet: los scripts son clásicos (sin `import`) y no hay fuentes externas.

## Estructura
- `css/` estilos · `js/core/` física y dibujo reutilizables · `js/data/sims.js` lista de simulaciones
- `js/components/` navbar, `numeric.js` (entradas numéricas), `didactic.js` (guía didáctica desde JSON)
- `js/sims/` una simulación por archivo · `simuladores/` una página por simulación
- Los módulos se comparten con el espacio de nombres global `CA`.
