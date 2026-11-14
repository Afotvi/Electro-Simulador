(function () {
'use strict';
const CA = (window.CA = window.CA || {});
// Motor base: se encarga del canvas, del bucle de animación, de las coordenadas y del mouse/touch.
// Cada simulación solo le pasa `update` y `draw`.
//
// Sistema de coordenadas del "mundo": metros, con el eje Y hacia ARRIBA y el origen al centro.
// El motor convierte a píxeles con `toScreen` y de vuelta con `toWorld`.

class SimCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   *   scale  píxeles por metro (zoom)
   *   update (dt, engine) => void     física, dt en segundos
   *   draw   (ctx, engine) => void    dibujo
   *   onDown/onMove/onUp (p, engine)  p = { x, y (mundo), sx, sy (pantalla) }
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = opts.scale ?? 200;
    this.update = opts.update ?? (() => {});
    this.draw = opts.draw ?? (() => {});
    this.onDown = opts.onDown ?? (() => {});
    this.onMove = opts.onMove ?? (() => {});
    this.onUp = opts.onUp ?? (() => {});

    this.time = 0;
    this.paused = false;
    this._last = 0;
    this._tick = this._tick.bind(this);

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas);
    this.resize();
    this._bindPointer();
  }

  // --- tamaño y nitidez (pantallas retina) ---
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ox = this.w / 2; // origen del mundo en pantalla
    this.oy = this.h / 2;
  }

  // --- conversiones mundo <-> pantalla ---
  toScreen(x, y) { return { x: this.ox + x * this.scale, y: this.oy - y * this.scale }; }
  toWorld(sx, sy) { return { x: (sx - this.ox) / this.scale, y: (this.oy - sy) / this.scale }; }
  get bounds() { // límites visibles del mundo en metros
    const hw = this.w / 2 / this.scale, hh = this.h / 2 / this.scale;
    return { xmin: -hw, xmax: hw, ymin: -hh, ymax: hh };
  }

  // --- bucle ---
  start() { if (!this._raf) this._raf = requestAnimationFrame(this._tick); return this; }
  stop() { cancelAnimationFrame(this._raf); this._raf = null; }
  _tick(t) {
    const dt = Math.min((t - (this._last || t)) / 1000, 0.05); // limita saltos al cambiar de pestaña
    this._last = t;
    if (!this.paused) { this.time += dt; this.update(dt, this); }
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(this.ctx, this);
    this._raf = requestAnimationFrame(this._tick);
  }

  // --- mouse y touch con la misma API ---
  _bindPointer() {
    const c = this.canvas;
    const pack = (e) => {
      const r = c.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      return { sx, sy, ...this.toWorld(sx, sy) };
    };
    c.addEventListener('pointerdown', (e) => { c.setPointerCapture(e.pointerId); this.onDown(pack(e), this); });
    c.addEventListener('pointermove', (e) => this.onMove(pack(e), this));
    c.addEventListener('pointerup', (e) => this.onUp(pack(e), this));
    c.addEventListener('pointercancel', (e) => this.onUp(pack(e), this));
  }
}
Object.assign(CA, { SimCanvas });
})();
