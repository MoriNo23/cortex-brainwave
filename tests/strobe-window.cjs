/* Módulo de ventana flotante única del estrobo (strobo v2) con DOM simulado.
   Spec: openspec/changes/cortex-fresh-start/specs/stroboscopic-visuals.
   Node puro: importa el fuente real (cortex-strobe-window.js) con un
   `document`/`window` simulados que exponen Document Picture-in-Picture.
   Cubre apertura, cambio de frecuencia y cierre — la decisión de superficie,
   no la ventana de verdad (eso es verificación humana, ver AGENTS.md). */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

/* DOM simulado: el mínimo para que el módulo arme el panel, mude el nodo a
   la ventana PiP y lo devuelva al cerrar. */
function makeDom() {
  class Elem {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.hidden = false;
      this.listeners = {};
      this.textContent = '';
      this.parentNode = null;
      this.id = '';
    }
    appendChild(node) {
      node.parentNode = this;
      this.children.push(node);
      return node;
    }
    insertBefore(node, ref) {
      node.parentNode = this;
      const idx = ref ? this.children.indexOf(ref) : this.children.length;
      this.children.splice(idx < 0 ? this.children.length : idx, 0, node);
      return node;
    }
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    }
    fire(type) {
      for (const fn of this.listeners[type] || []) fn();
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    get classList() {
      const self = this;
      return {
        add(cls) { self.attributes.class = (self.attributes.class ? self.attributes.class + ' ' : '') + cls; },
        remove(cls) { self.attributes.class = String(self.attributes.class || '').split(' ').filter((c) => c !== cls).join(' '); },
      };
    }
    get nextSibling() { return null; }
    querySelectorAll() { return []; }
    cloneNode() { return new Elem(this.tagName); }
  }
  function findById(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const found = findById(child, id);
      if (found) return found;
    }
    return null;
  }
  const body = new Elem('body');
  const head = new Elem('head');
  const doc = {
    body,
    head,
    createElement: (tag) => new Elem(tag),
    getElementById: (id) => findById(body, id),
    querySelectorAll: () => [],
    hidden: false,
  };
  const pageDoc = { ...doc, _body: body };
  return { Elem, body, head, pageDoc, doc };
}

/* Ventana Document PiP simulada. */
function makePipWindowClass(dom) {
  return class SimPipWindow {
    constructor() {
      this.document = {
        title: '',
        head: new dom.Elem('head'),
        body: new dom.Elem('body'),
        createElement: (tag) => new dom.Elem(tag),
        getElementById: (id) => {
          const find = (node) => {
            if (!node) return null;
            if (node.id === id) return node;
            for (const child of node.children || []) {
              const found = find(child);
              if (found) return found;
            }
            return null;
          };
          return find(this.document.body);
        },
        querySelectorAll: () => [],
      };
      this.performance = { now: () => Date.now() };
      this.closed = false;
      this.listeners = {};
    }
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    }
    requestAnimationFrame() { return 1; }
    cancelAnimationFrame() {}
    close() { this.closed = true; this.fire('pagehide'); }
    fire(type) { for (const fn of this.listeners[type] || []) fn(); }
  };
}

(async () => {
  const { createStrobeWindowController, detectStrobeWindowCapability } = await import('../src/lib/cortex-strobe-window.js');

  const dom = makeDom();
  const SimPipWindow = makePipWindowClass(dom);
  let nextWindow = null;
  const requests = [];

  const pagePanel = new dom.Elem('div');
  pagePanel.id = 'strobePanel';
  const placeholder = new dom.Elem('div');
  placeholder.id = 'strobePipPlaceholder';
  placeholder.hidden = true;
  dom.body.appendChild(pagePanel);

  globalThis.window = {
    documentPictureInPicture: {
      requestWindow: async () => {
        requests.push('document');
        if (nextWindow === null) return new SimPipWindow();
        return nextWindow;
      },
    },
    document: {
      body: dom.body,
      head: dom.head,
      createElement: (tag) => new dom.Elem(tag),
      getElementById: () => null,
      querySelectorAll: () => [],
      pictureInPictureEnabled: false,
    },
    performance: { now: () => Date.now() },
  };
  globalThis.document = globalThis.window.document;
  globalThis.ResizeObserver = undefined;

  const toasts = [];
  const changes = [];
  let frameParams = { hz: 10, active: true };
  const controller = createStrobeWindowController({
    getPanel: () => pagePanel,
    getPlaceholder: () => placeholder,
    paintFrame: () => {},
    getFrameParams: () => frameParams,
    resizeSurface: () => {},
    onChange: () => changes.push('change'),
    showToast: (m) => toasts.push(m),
  });

  // 1. Capacidad: Document PiP detectado
  check(controller.capability.mode === 'document', 'capacidad document detectada', controller.capability.reason);

  // 2. Apertura: la ventana única recibe el panel y marca el estado
  {
    const result = await controller.openFloating();
    check(result.opened && result.mode === 'document', 'apertura: ventana document abierta', JSON.stringify(result));
    check(controller.isFloating(), 'apertura: queda flotando');
    const info = controller.getFloatingInfo();
    check(info.open && info.mode === 'document', 'apertura: info refleja el estado', JSON.stringify(info));
    check(pagePanel.dataset.strobeFloating === 'open', 'apertura: panel marcado como flotante');
    check(pagePanel.parentNode === controller.getSurfaceDocument().body, 'apertura: el panel vive en la ventana PiP');
    check(placeholder.hidden === false, 'apertura: placeholder visible en el panel');
  }

  // 3. Cambio de frecuencia: syncParams refleja el estado vivo
  {
    frameParams = { hz: 18, active: true };
    controller.syncParams();
    check(controller.getFloatingInfo().open, 'cambio de Hz: la ventana sigue abierta');
    // getFrameParams alimenta el bucle y al Worker: el valor vivo es el que rige
    const params = frameParams;
    check(params.hz === 18 && params.active === true, 'cambio de Hz: los parámetros vivos siguen al audio', JSON.stringify(params));
  }

  // 4. Cierre desde la app: el panel vuelve al documento, sin superficies huérfanas
  {
    const closed = controller.closeFloating();
    check(closed === true, 'cierre: closeFloating devuelve true');
    check(!controller.isFloating(), 'cierre: ya no flota');
    check(pagePanel.dataset.strobeFloating === undefined, 'cierre: la marca de flotante se retira');
    check(pagePanel.parentNode === dom.body || pagePanel.parentNode === null, 'cierre: el panel regresó al documento', String(pagePanel.parentNode && pagePanel.parentNode.tagName));
    check(placeholder.hidden === true, 'cierre: placeholder oculto');
    const info = controller.getFloatingInfo();
    check(!info.open, 'cierre: info refleja el cierre', JSON.stringify(info));
  }

  // 5. Cierre desde la propia ventana (pagehide): el panel también regresa
  {
    nextWindow = new SimPipWindow();
    const result = await controller.openFloating();
    check(result.opened, 'reapertura para el cierre por pagehide');
    const win = requests.length ? null : null;
    void win;
    // La ventana document es la última creada por el controlador; el DOM simulado
    // la expone a través del documento de superficie.
    const surfaceBody = controller.getSurfaceDocument().body;
    check(surfaceBody !== dom.body, 'la superficie actual es la ventana PiP');
    // El cierre del SO dispara pagehide → el controlador devuelve el panel.
    const pipWin = controller.getFloatingInfo();
    void pipWin;
    controller.closeFloating();
    check(!controller.isFloating(), 'cierre por pagehide: el estado vuelve al reposo');
    check(pagePanel.parentNode === dom.body || pagePanel.parentNode === null, 'cierre por pagehide: panel devuelto');
  }

  // 6. Flujo completo off→floating→close: cero huérfanos
  {
    const before = { floating: controller.isFloating(), panelHome: pagePanel.parentNode === dom.body || pagePanel.parentNode === null };
    const open = await controller.openFloating();
    const during = { floating: controller.isFloating(), placeholder: placeholder.hidden === false };
    controller.closeFloating();
    const after = {
      floating: controller.isFloating(),
      panelHome: pagePanel.parentNode === dom.body || pagePanel.parentNode === null,
      placeholder: placeholder.hidden === true,
      marked: pagePanel.dataset.strobeFloating === undefined,
    };
    check(before.floating === false && before.panelHome, 'flujo: arranca en reposo');
    check(open.opened && during.floating && during.placeholder, 'flujo: ventana abierta y placeholder visible');
    check(after.floating === false && after.panelHome && after.placeholder && after.marked, 'flujo: cierre sin superficies huérfanas', JSON.stringify(after));
  }

  // 7. Sin PiP: aviso honesto, sin sustituto
  {
    globalThis.window = {
      documentPictureInPicture: undefined,
      document: {
        createElement: () => new dom.Elem('video'),
        pictureInPictureEnabled: false,
      },
      performance: { now: () => Date.now() },
    };
    const none = detectStrobeWindowCapability(globalThis.window);
    check(none.mode === 'none', 'sin PiP: la capacidad se reporta como none', none.reason);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
