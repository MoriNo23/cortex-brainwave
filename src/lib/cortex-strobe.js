import {
  normalizeStrobePresentation,
  normalizeStrobeState,
} from './cortex-persistence.js';
import {
  clampStrobeHz,
  strobeFrequencyFromState,
  strobeIntensityWindow,
} from './core-math.js';
import { STROBE_PALETTE, paintStrobeSurface } from './cortex-strobe-paint.js';
import { createStrobePipController } from './cortex-strobe-pip.js';

export function createStrobeController({
  state,
  persistUiPreferences,
  showToast,
  markUiDirty,
}) {
  let pip = null;
  let surfaceObserver = null;

  /* El panel puede estar en el documento principal o dentro de la ventana
     flotante (PiP): toda lectura/escritura de DOM pasa por aquí. */
  function surfaceDocument() {
    return pip ? pip.getSurfaceDocument() : document;
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
    return Boolean(pip && pip.isFloating());
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
    return state.strobe.presentation === 'mini' ? 'Mini player' : 'Integrado';
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
    const miniBtn = doc.getElementById('btnStrobeMini');
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
    setText(miniBtn, state.strobe.presentation === 'mini' ? '↘ Integrado' : '◫ Mini player');
    setText(floatBtn, floating ? '✕ Cerrar ventana' : '⧉ Ventana flotante');
    setText(fullscreenBtn, isFullscreen ? '🡼 Salir full' : '⛶ Pantalla completa');
    setText(playBtn, state.strobe.active ? '▶ En marcha' : '▶ Play');
    if (playBtn) playBtn.setAttribute('aria-pressed', state.strobe.active ? 'true' : 'false');
    if (stopBtn) stopBtn.setAttribute('aria-pressed', state.strobe.active ? 'false' : 'true');
    if (panel) {
      panel.dataset.strobePresentation = isFullscreen ? 'fullscreen' : state.strobe.presentation;
      panel.dataset.strobeRunning = state.strobe.active ? 'on' : 'off';
      panel.dataset.strobeFloating = floating ? 'open' : 'closed';
    }
    if (miniBtn) miniBtn.disabled = floating;
    if (fullscreenBtn) fullscreenBtn.disabled = floating;
    setText(modeLabel, state.strobe.mode === 'sync' ? 'Sync Brainwave' : 'Frecuencia propia');
    setText(hzLabel, `${effectiveStrobeHz().toFixed(1)} Hz`);
    setText(valHz, `${state.strobe.customHz.toFixed(1)} Hz`);
    setText(presentationLabel, presentationName(isFullscreen));
  }

  /* ── SUPERFICIE ── */

  /* El backing store sigue al tamaño real del lienzo (con DPR acotado a 2).
     Antes se escribía `style.width/height` en px, lo que congelaba el canvas al
     primer rect medido y rompía el `width:100%` del CSS. */
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
    return pip && pip.getSurfaceDocument().defaultView ? pip.getSurfaceDocument().defaultView : window;
  }

  /* El contenedor puede cambiar de tamaño sin `resize` de ventana (dock,
     fullscreen, ventana flotante): el observador cubre esos casos. */
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
    if (pip) pip.syncParams();
    renderStrobeControls();
  }

  function setStrobePresentation(nextPresentation) {
    state.strobe.presentation = normalizeStrobePresentation(nextPresentation);
    renderStrobeControls();
    resizeStrobeCanvas();
    persistUiPreferences();
  }

  function toggleStrobeMini() {
    setStrobePresentation(state.strobe.presentation === 'mini' ? 'integrated' : 'mini');
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
        /* `requestFullscreen` rechaza sin activación de usuario o con la
           política de permisos en contra: sin captura queda un rechazo sin
           manejar en consola. */
        showToast(`pantalla completa no disponible (${error.message})`);
      }
    }
    renderStrobeControls();
    resizeStrobeCanvas();
  }

  async function toggleStrobeFloating() {
    if (!pip) return;
    if (pip.isFloating()) {
      pip.closeFloating();
      showToast('ventana flotante cerrada');
      return;
    }
    if (document.fullscreenElement) {
      showToast('sal de pantalla completa para abrir la ventana flotante');
      return;
    }
    const result = await pip.openFloating();
    if (result.opened) {
      showToast(result.mode === 'document'
        ? 'estrobo en ventana flotante — sigue visible al cambiar de pestaña'
        : 'estrobo en PiP de vídeo — sigue visible al cambiar de pestaña');
      return;
    }
    /* Sin PiP disponible el mini player integrado es el mejor plan B: al menos
       la superficie queda desacoplada del scroll. */
    setStrobePresentation('mini');
    showToast(`ventana flotante no disponible (${result.reason}) — mini player activado`);
  }

  function setStrobeMode(mode, { persist = true } = {}) {
    state.strobe.mode = mode === 'custom' ? 'custom' : 'sync';
    if (pip) pip.syncParams();
    renderStrobeControls();
    if (persist) persistUiPreferences();
  }

  function setStrobeCustomHz(value, { persist = false, deferRender = false } = {}) {
    state.strobe.customHz = clampStrobeHz(value);
    if (pip) pip.syncParams();
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
    pip = createStrobePipController({
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
    document.getElementById('btnStrobeMini')?.addEventListener('click', toggleStrobeMini);
    document.getElementById('btnStrobeFloat')?.addEventListener('click', toggleStrobeFloating);
    document.getElementById('btnStrobeFullscreen')?.addEventListener('click', toggleStrobeFullscreen);
    document.getElementById('strobePipClose')?.addEventListener('click', () => {
      if (!pip) return;
      pip.closeFloating();
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
    getFloatingInfo: () => (pip ? pip.getFloatingInfo() : { open: false, capability: 'unbound' }),
    getPipCapability: () => (pip ? pip.capability.mode : 'unbound'),
    handleFullscreenChange,
    paintFrame,
    renderStrobeControls,
    resizeStrobeCanvas,
    setStrobeActive,
    setStrobeCustomHz,
    setStrobeMode,
    setStrobePresentation,
    toggleStrobeFloating,
    toggleStrobeFullscreen,
    toggleStrobeMini,
  };
}
