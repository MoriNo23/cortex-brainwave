import {
  normalizeStrobeState,
} from './cortex-persistence.js';
import {
  clampStrobeHz,
  strobeFrequencyFromState,
  strobeIntensityWindow,
} from './core-math.js';
import { STROBE_PALETTE, paintStrobeSurface } from './cortex-strobe-paint.js';
import { createStrobeWindowController } from './cortex-strobe-window.js';

export function createStrobeController({
  state,
  persistUiPreferences,
  showToast,
  markUiDirty,
}) {
  let windowController = null;
  let surfaceObserver = null;

  /* El panel puede estar en el documento principal o dentro de la ventana
     flotante: toda lectura/escritura de DOM pasa por aquí. */
  function surfaceDocument() {
    return windowController ? windowController.getSurfaceDocument() : document;
  }

  function getCanvas(doc = surfaceDocument()) {
    return doc.getElementById('strobeCanvas');
  }

  function getContext(canvas = getCanvas()) {
    return canvas ? canvas.getContext('2d') : null;
  }

  function effectiveStrobeHz() {
    return strobeFrequencyFromState(state.strobe, state);
  }

  function isFloating() {
    return Boolean(windowController && windowController.isFloating());
  }

  function setText(target, value) {
    if (!target) return false;
    const next = String(value);
    if (target.textContent === next) return false;
    target.textContent = next;
    return true;
  }

  function presentationName(isFullscreen) {
    if (isFloating()) return 'Ventana flotante';
    if (isFullscreen) return 'Pantalla completa';
    return 'Integrado';
  }

  function renderStrobeControls() {
    state.strobe = {
      ...state.strobe,
      ...normalizeStrobeState(state.strobe),
      active: Boolean(state.strobe.active),
    };
    const doc = surfaceDocument();
    const sync = doc.getElementById('strobeModeSync');
    const custom = doc.getElementById('strobeModeCustom');
    const slider = doc.getElementById('sliderStrobeHz');
    const floatBtn = doc.getElementById('btnStrobeFloat');
    const fullscreenBtn = doc.getElementById('btnStrobeFullscreen');
    const playBtn = doc.getElementById('btnStrobePlay');
    const stopBtn = doc.getElementById('btnStrobeStop');
    const panel = doc.getElementById('strobePanel');
    const modeLabel = doc.getElementById('strobeModeLabel');
    const hzLabel = doc.getElementById('strobeHzLabel');
    const valHz = doc.getElementById('valStrobeHz');
    const presentationLabel = doc.getElementById('strobePresentationLabel');
    const isFullscreen = document.fullscreenElement !== null && document.fullscreenElement === panel;
    const floating = isFloating();

    if (sync) sync.checked = state.strobe.mode === 'sync';
    if (custom) custom.checked = state.strobe.mode === 'custom';
    if (slider) {
      slider.disabled = state.strobe.mode !== 'custom';
      if (Number(slider.value) !== state.strobe.customHz) slider.value = state.strobe.customHz;
    }
    setText(floatBtn, floating ? '✕ Cerrar ventana' : '⧉ Ventana flotante');
    setText(fullscreenBtn, isFullscreen ? '🡼 Salir full' : '⛶ Pantalla completa');
    setText(playBtn, state.strobe.active ? '▶ En marcha' : '▶ Play');
    if (playBtn) playBtn.setAttribute('aria-pressed', state.strobe.active ? 'true' : 'false');
    if (stopBtn) stopBtn.setAttribute('aria-pressed', state.strobe.active ? 'false' : 'true');
    if (panel) {
      panel.dataset.strobePresentation = isFullscreen ? 'fullscreen' : 'integrated';
      panel.dataset.strobeRunning = state.strobe.active ? 'on' : 'off';
      panel.dataset.strobeFloating = floating ? 'open' : 'closed';
    }
    if (fullscreenBtn) fullscreenBtn.disabled = floating;
    setText(modeLabel, state.strobe.mode === 'sync' ? 'Sync Brainwave' : 'Frecuencia propia');
    setText(hzLabel, `${effectiveStrobeHz().toFixed(1)} Hz`);
    setText(valHz, `${state.strobe.customHz.toFixed(1)} Hz`);
    setText(presentationLabel, presentationName(isFullscreen));
  }

  /* ── SUPERFICIE ── */

  function resizeStrobeCanvas() {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(surfaceWindow().devicePixelRatio || 1, 2);
    const cssWidth = rect.width || canvas.parentElement?.clientWidth || 240;
    const cssHeight = rect.height || cssWidth;
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    observeSurface();
  }

  function surfaceWindow() {
    return windowController && windowController.getSurfaceDocument().defaultView
      ? windowController.getSurfaceDocument().defaultView
      : window;
  }

  function observeSurface() {
    const canvas = getCanvas();
    if (!canvas || typeof ResizeObserver !== 'function') return;
    const wrap = canvas.parentElement;
    if (!wrap || surfaceObserver?.target === wrap) return;
    if (surfaceObserver) surfaceObserver.observer.disconnect();
    const observer = new ResizeObserver(() => {
      const node = getCanvas();
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const dpr = Math.min(surfaceWindow().devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round((rect.width || 240) * dpr));
      const height = Math.max(1, Math.round((rect.height || rect.width || 240) * dpr));
      if (node.width !== width) node.width = width;
      if (node.height !== height) node.height = height;
    });
    observer.observe(wrap);
    surfaceObserver = { observer, target: wrap };
  }

  /* Fotograma del estrobo. `intensity` viene de la fase verificada contra la
     referencia de Python; cuando la superficie no está visible se pinta en
     reposo para que nunca quede un frame encendido congelado. */
  function paintFrame(ts) {
    const canvas = getCanvas();
    const ctx = getContext(canvas);
    if (!canvas || !ctx) return;
    const now = typeof ts === 'number' ? ts : surfaceWindow().performance.now();
    const doc = surfaceDocument();
    const running = state.strobe.active && !doc.hidden;
    const pulse = running
      ? strobeIntensityWindow(effectiveStrobeHz(), now)
      : { intensity: 0 };
    paintStrobeSurface(ctx, canvas.width, canvas.height, pulse.intensity, STROBE_PALETTE);
  }

  function drawStrobeFrame(ts) {
    paintFrame(ts);
  }

  /* Al ocultar la pestaña el rAF se congela: sin esto la superficie se queda en
     el último fotograma, que puede ser el encendido. Se aplica solo al canvas
     del documento principal; si el estrobo vive en la ventana flotante, ese
     canvas no está aquí y la ventana sigue con su propio bucle. */
  function handleDocumentHidden() {
    if (!document.hidden) {
      resizeStrobeCanvas();
      return;
    }
    const canvas = document.getElementById('strobeCanvas');
    const ctx = getContext(canvas);
    if (!canvas || !ctx) return;
    paintStrobeSurface(ctx, canvas.width, canvas.height, 0, STROBE_PALETTE);
  }

  /* ── CONTROLES ── */

  function setStrobeActive(nextActive) {
    state.strobe.active = Boolean(nextActive);
    if (windowController) windowController.syncParams();
    renderStrobeControls();
  }

  async function toggleStrobeFullscreen() {
    const panel = surfaceDocument().getElementById('strobePanel');
    if (!panel) return;
    if (document.fullscreenElement === panel) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
      } catch (error) {
        showToast(`no se pudo salir de pantalla completa (${error.message})`);
      }
    } else if (panel.requestFullscreen) {
      try {
        await panel.requestFullscreen();
      } catch (error) {
        showToast(`pantalla completa no disponible (${error.message})`);
      }
    }
    renderStrobeControls();
    resizeStrobeCanvas();
  }

  async function toggleStrobeFloating() {
    if (!windowController) return;
    if (windowController.isFloating()) {
      windowController.closeFloating();
      showToast('ventana flotante cerrada');
      return;
    }
    if (document.fullscreenElement) {
      showToast('sal de pantalla completa para abrir la ventana flotante');
      return;
    }
    const result = await windowController.openFloating();
    if (result.opened) {
      showToast(result.mode === 'document'
        ? 'estrobo en ventana flotante — sigue visible al cambiar de pestaña'
        : 'estrobo en PiP de vídeo — sigue visible al cambiar de pestaña');
      return;
    }
    /* Sin PiP disponible no hay sustituto: la vista integrada es la única
       superficie y se dice con honestidad. Nada de mini player fingido. */
    showToast(`ventana flotante no disponible (${result.reason}) — queda la vista integrada`);
  }

  function setStrobeMode(mode, { persist = true } = {}) {
    state.strobe.mode = mode === 'custom' ? 'custom' : 'sync';
    if (windowController) windowController.syncParams();
    renderStrobeControls();
    if (persist) persistUiPreferences();
  }

  function setStrobeCustomHz(value, { persist = false, deferRender = false } = {}) {
    state.strobe.customHz = clampStrobeHz(value);
    if (windowController) windowController.syncParams();
    if (deferRender) {
      markUiDirty('strobe');
      return;
    }
    renderStrobeControls();
    if (persist) persistUiPreferences();
  }

  function handleFullscreenChange() {
    renderStrobeControls();
    resizeStrobeCanvas();
  }

  function bindStrobeEvents() {
    windowController = createStrobeWindowController({
      getPanel: () => document.getElementById('strobePanel'),
      getPlaceholder: () => document.getElementById('strobePipPlaceholder'),
      paintFrame,
      getFrameParams: () => ({ hz: effectiveStrobeHz(), active: state.strobe.active }),
      resizeSurface: resizeStrobeCanvas,
      onChange: renderStrobeControls,
      showToast,
    });

    document.getElementById('btnStrobePlay')?.addEventListener('click', () => {
      setStrobeActive(true);
      showToast(`estroboscopio → ${effectiveStrobeHz().toFixed(1)} Hz`);
    });
    document.getElementById('btnStrobeStop')?.addEventListener('click', () => {
      setStrobeActive(false);
      showToast('estroboscopio detenido');
    });
    document.getElementById('btnStrobeFloat')?.addEventListener('click', toggleStrobeFloating);
    document.getElementById('btnStrobeFullscreen')?.addEventListener('click', toggleStrobeFullscreen);
    document.getElementById('strobePipClose')?.addEventListener('click', () => {
      if (!windowController) return;
      windowController.closeFloating();
      showToast('ventana flotante cerrada');
    });
    document.getElementById('strobeModeSync')?.addEventListener('change', (event) => {
      if (!event.target.checked) return;
      setStrobeMode('sync');
    });
    document.getElementById('strobeModeCustom')?.addEventListener('change', (event) => {
      if (!event.target.checked) return;
      setStrobeMode('custom');
    });
    document.getElementById('sliderStrobeHz')?.addEventListener('input', (event) => {
      setStrobeCustomHz(event.target.value, { deferRender: true });
    });
    document.getElementById('sliderStrobeHz')?.addEventListener('change', (event) => {
      setStrobeCustomHz(event.target.value, { persist: true });
    });

    document.addEventListener('visibilitychange', handleDocumentHidden);
    renderStrobeControls();
  }

  return {
    bindStrobeEvents,
    drawStrobeFrame,
    effectiveStrobeHz,
    getFloatingInfo: () => (windowController ? windowController.getFloatingInfo() : { open: false, capability: 'unbound' }),
    getPipCapability: () => (windowController ? windowController.capability.mode : 'unbound'),
    handleFullscreenChange,
    paintFrame,
    renderStrobeControls,
    resizeStrobeCanvas,
    setStrobeActive,
    setStrobeCustomHz,
    setStrobeMode,
    toggleStrobeFloating,
    toggleStrobeFullscreen,
  };
}
