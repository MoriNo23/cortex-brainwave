/* Atajos de teclado con guardas de foco (tarea 5.7 de cortex-fresh-start).
   Spec: desktop-workspace-ux — «Atajo ignorado al escribir».
   Node puro: importa el fuente real (cortex-app-events.js) y ejercita
   bindKeyboardShortcuts con DOM simulado. La garantía es la guarda: con el
   foco en un input, la tecla escribe y no dispara transporte; sin foco en
   control interactivo, cada atajo activa su control visible equivalente. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const { bindKeyboardShortcuts, isInteractiveTarget } = await import('../src/lib/cortex-app-events.js');

  /* DOM simulado: document con registro de listeners y botones contables. */
  const listeners = {};
  const clicks = {};
  const buttons = {};
  for (const id of ['btnPlay', 'btnTimelinePause', 'inspectorMoveUp', 'inspectorMoveDown']) {
    buttons[id] = {
      click() { clicks[id] = (clicks[id] || 0) + 1; },
    };
  }
  globalThis.document = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    getElementById: (id) => buttons[id] || null,
  };

  let dockToggles = 0;
  let pauseToggles = 0;
  bindKeyboardShortcuts({
    getButton: (id) => buttons[id] || null,
    toggleDock: () => { dockToggles += 1; },
    togglePause: () => { pauseToggles += 1; },
  });

  const fire = (code, target = null, modifiers = {}) => {
    let prevented = false;
    const event = {
      code,
      target,
      ctrlKey: !!modifiers.ctrl,
      metaKey: false,
      altKey: false,
      preventDefault() { prevented = true; },
    };
    for (const fn of listeners.keydown || []) fn(event);
    return prevented;
  };

  /* Elementos simulados con tagName — lo único que la guarda consulta. */
  const inputEl = { nodeType: 1, tagName: 'INPUT' };
  const buttonEl = { nodeType: 1, tagName: 'BUTTON' };
  const selectEl = { nodeType: 1, tagName: 'SELECT' };
  const textareaEl = { nodeType: 1, tagName: 'TEXTAREA' };
  const bodyEl = { nodeType: 1, tagName: 'BODY' };

  // 1. La guarda: foco en input → Space escribe, no dispara transporte
  {
    const prevented = fire('Space', inputEl);
    check(clicks.btnPlay === undefined, 'foco en input: Space no dispara el transporte', `clicks=${clicks.btnPlay || 0}`);
    check(prevented === false, 'foco en input: el navegador sigue con la tecla (sin preventDefault)');
  }

  // 1b. La letra del atajo escribe en el input, no plegar/transporte
  {
    fire('KeyP', inputEl);
    fire('KeyT', inputEl);
    fire('BracketLeft', inputEl);
    check(clicks.btnTimelinePause === undefined && dockToggles === 0 && clicks.inspectorMoveUp === undefined,
      'foco en input: P, T y [ tampoco disparan nada');
  }

  // 2. La guarda cubre todos los interactivos
  {
    check(isInteractiveTarget(inputEl), 'INPUT es interactivo');
    check(isInteractiveTarget(buttonEl), 'BUTTON es interactivo');
    check(isInteractiveTarget(selectEl), 'SELECT es interactivo');
    check(isInteractiveTarget(textareaEl), 'TEXTAREA es interactivo');
    check(isInteractiveTarget({ nodeType: 1, tagName: 'DIV', isContentEditable: true }), 'contentEditable es interactivo');
    check(!isInteractiveTarget(bodyEl), 'BODY no es interactivo');
    check(!isInteractiveTarget(null), 'null no es interactivo');
  }

  // 3. Sin foco interactivo: cada atajo activa su control visible
  {
    fire('Space', bodyEl);
    check(clicks.btnPlay === 1, 'Space en la página dispara ▶ Iniciar', `clicks=${clicks.btnPlay}`);
    fire('KeyP', bodyEl);
    check(pauseToggles === 1, 'P dispara la pausa del transporte (audio + secuencia)', `toggles=${pauseToggles}`);
    fire('BracketLeft', bodyEl);
    check(clicks.inspectorMoveUp === 1, '[ dispara el paso anterior', `clicks=${clicks.inspectorMoveUp}`);
    fire('BracketRight', bodyEl);
    check(clicks.inspectorMoveDown === 1, '] dispara el paso siguiente', `clicks=${clicks.inspectorMoveDown}`);
    fire('KeyT', bodyEl);
    check(dockToggles === 1, 'T pliega/despliega el timeline', `toggles=${dockToggles}`);
  }

  // 4. Con modificadores no actúa: Ctrl+Space es del navegador/OS
  {
    fire('Space', bodyEl, { ctrl: true });
    check(clicks.btnPlay === 1, 'Ctrl+Space no dispara transporte', `clicks=${clicks.btnPlay}`);
  }

  // 5. Foco en botón: la tecla activa ESE botón (nativo), no el atajo
  {
    fire('Space', buttonEl);
    check(clicks.btnPlay === 1, 'foco en un botón: Space es de ese botón, no del atajo', `clicks=${clicks.btnPlay}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
