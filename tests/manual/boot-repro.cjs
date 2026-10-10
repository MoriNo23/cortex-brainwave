/* Reproducción del arranque real de la app en Node: montar el HTML del build
   con DOM/canvas/storage stubbeados y ejecutar el bundle real. Objetivo: ver
   QUÉ lanza (o dónde muere) el init() con el HTML de producción. */
const { readFileSync } = require('fs');
const path = require('path');

const html = readFileSync(path.resolve('dist/index.html'), 'utf8');
const bundleName = (html.match(/src="([^"]*index[^"]*\.js)"/) || [])[1];
const bundlePath = path.resolve('dist', bundleName.replace(/^\//, ''));

/* ── DOM mínimo pero real: parseo los ids del HTML ── */
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
const elements = {};

class ListenerMap {
  constructor() { this.map = new Map(); }
  addEventListener(type, fn) { (this.map.get(type) || this.map.set(type, []).get(type)).push(fn); }
  removeEventListener(type, fn) { const a = this.map.get(type) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }
  dispatch(type, event) { for (const fn of [...(this.map.get(type) || [])]) fn(event); }
}

class Element extends ListenerMap {
  constructor(tag, id) {
    super();
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.style = new Proxy({}, { set: () => true });
    this.textContent = '';
    this.innerHTML = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.parentNode = null;
    this.clientWidth = 800;
    this.clientHeight = 600;
  }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  insertBefore(n) { n.parentNode = this; this.children.unshift(n); return n; }
  replaceChildren(...nodes) { this.children = nodes; for (const n of nodes) n.parentNode = this; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(t, fn) {
    if (this.tagName === 'BUTTON' && t === 'click') clicks.push(this.id || 'anon');
    super.addEventListener(t, fn);
  }
  querySelectorAll(sel) {
    // devuelve elementos que ya existan en el registro con la clase
    const cls = (sel.match(/\.([\w-]+)/) || [])[1];
    if (!cls) return [];
    return Object.values(elements).filter((el) => el.classList && String(el.attributes.class || '').includes(cls));
  }
  getBoundingClientRect() { return { width: 800, height: 600, top: 0, left: 0 }; }
  get parentElement() { return globalThis.document.body; }
  getContext() { return null; }
  requestFullscreen() { return Promise.resolve(); }
  click() { this.dispatch('click', { target: this }); }
}

const clicks = [];

for (const id of ids) {
  const el = new Element('div', id);
  elements[id] = el;
}
/* elementos creados dinámicamente: createElement devuelve Element y lo registra */
const created = [];

globalThis.document = {
  nodeType: 9,
  hidden: false,
  fullscreenElement: null,
  body: new Element('body', 'body'),
  head: new Element('head', 'head'),
  documentElement: new Element('html', 'html'),
  getElementById: (id) => elements[id] || null,
  createElement: (tag) => { const el = new Element(tag, ''); created.push(el); return el; },
  querySelectorAll: (sel) => {
    const id = (sel.match(/#([\w-]+)/) || [])[1];
    if (id && elements[id]) return [elements[id]];
    const cls = (sel.match(/\.([\w-]+)/) || [])[1];
    if (cls) return Object.values(elements).filter((el) => String(el.attributes.class || '').includes(cls));
    return [];
  },
  querySelector: (sel) => (document.querySelectorAll(sel)[0] || null),
  addEventListener(type, fn) { (docListeners.get(type) || docListeners.set(type, []).get(type)).push(fn); },
  dispatchEvent() { return true; },
  pictureInPictureElement: null,
  pictureInPictureEnabled: true,
  exitPictureInPicture: () => Promise.resolve(),
  visibilityState: 'visible',
};
const docListeners = new Map();

/* clases del markup: presets, glossary items, dock-clip… el regex de ids no las ve.
   Extraigo también class del HTML para los querySelectorAll('.preset') etc. */
for (const m of html.matchAll(/id="([^"]+)"[^>]*class="([^"]*)"/g)) {
  const el = elements[m[1]];
  if (el) el.attributes.class = m[2];
}
for (const m of html.matchAll(/class="([^"]*)"[^>]*id="([^"]+)"/g)) {
  const el = elements[m[2]];
  if (el) el.attributes.class = m[1];
}

class WindowClass extends ListenerMap {
  constructor() {
    super();
    this.document = globalThis.document;
    this.devicePixelRatio = 1;
    this.documentPictureInPicture = { requestWindow: async () => null };
  }
  addEventListener(t, fn) { super.addEventListener(t, fn); }
  getComputedStyle() { return { getPropertyValue: () => '' }; }
}
globalThis.window = new WindowClass();
globalThis.Window = WindowClass;
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
})();
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
globalThis.Blob = class { constructor(parts) { this.parts = parts; } };
globalThis.URL = { createObjectURL: () => 'blob:sim', revokeObjectURL: () => {} };
globalThis.Worker = class { constructor() {} postMessage() {} terminate() {} };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
globalThis.AudioContext = class { constructor() { return { state: 'suspended', currentTime: 0, resume: () => Promise.resolve() }; } };
globalThis.addEventListener = window.addEventListener.bind(window);

/* estado de clicks capturado para el diagnóstico */
globalThis.__CLICKS__ = clicks;

(async () => {
  console.log('ids del HTML registrados:', ids.length);
  try {
    await import(bundlePath);
    console.log('ARRANQUE OK — sin excepciones');
  } catch (error) {
    console.log('ARRANQUE LANZA:\n', error.stack || error.message || error);
  }
  /* ¿El botón Iniciar quedó vivo? */
  const btnPlay = elements['btnPlay'];
  const hasListener = btnPlay && btnPlay.map && (btnPlay.map.get('click') || []).length > 0;
  console.log('btnPlay con listener de click:', !!hasListener);
  if (hasListener) {
    console.log('— simulando click en Iniciar —');
    btnPlay.click();
    console.log('texto tras click:', JSON.stringify(btnPlay.textContent), '| status:', JSON.stringify(elements['statusText'] && elements['statusText'].textContent));
  }
})();
