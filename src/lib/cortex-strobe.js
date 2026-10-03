import {
  normalizeStrobePresentation,
  normalizeStrobeState,
} from './cortex-persistence.js';
import {
  clampStrobeHz,
  strobeFrequencyFromState,
  strobePhaseWindow,
} from './core-math.js';

function getCanvas() {
  return document.getElementById('strobeCanvas');
}

function getContext(canvas = getCanvas()) {
  return canvas ? canvas.getContext('2d') : null;
}

export function createStrobeController({
  state,
  persistUiPreferences,
  showToast,
  markUiDirty,
}) {
  function effectiveStrobeHz() {
    return strobeFrequencyFromState(state.strobe, state);
  }

  function renderStrobeControls() {
    state.strobe = {
      ...state.strobe,
      ...normalizeStrobeState(state.strobe),
      active: Boolean(state.strobe.active),
    };
    const sync = document.getElementById('strobeModeSync');
    const custom = document.getElementById('strobeModeCustom');
    const slider = document.getElementById('sliderStrobeHz');
    const miniBtn = document.getElementById('btnStrobeMini');
    const fullscreenBtn = document.getElementById('btnStrobeFullscreen');
    const panel = document.getElementById('strobePanel');
    const modeLabel = document.getElementById('strobeModeLabel');
    const hzLabel = document.getElementById('strobeHzLabel');
    const valHz = document.getElementById('valStrobeHz');
    const presentationLabel = document.getElementById('strobePresentationLabel');
    const isFullscreen = document.fullscreenElement === panel;
    if (sync) sync.checked = state.strobe.mode === 'sync';
    if (custom) custom.checked = state.strobe.mode === 'custom';
    if (slider) {
      slider.disabled = state.strobe.mode !== 'custom';
      slider.value = state.strobe.customHz;
    }
    if (miniBtn) miniBtn.textContent = state.strobe.presentation === 'mini' ? '↘ Integrado' : '◫ Mini player';
    if (fullscreenBtn) fullscreenBtn.textContent = isFullscreen ? '🡼 Salir full' : '⛶ Pantalla completa';
    if (panel) panel.dataset.strobePresentation = isFullscreen ? 'fullscreen' : state.strobe.presentation;
    if (modeLabel) modeLabel.textContent = state.strobe.mode === 'sync' ? 'Sync Brainwave' : 'Frecuencia propia';
    if (hzLabel) hzLabel.textContent = `${effectiveStrobeHz().toFixed(1)} Hz`;
    if (valHz) valHz.textContent = `${state.strobe.customHz.toFixed(1)} Hz`;
    if (presentationLabel) presentationLabel.textContent = isFullscreen ? 'Pantalla completa' : (state.strobe.presentation === 'mini' ? 'Mini player' : 'Integrado');
  }

  function setStrobeActive(nextActive) {
    state.strobe.active = Boolean(nextActive);
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
    const panel = document.getElementById('strobePanel');
    if (!panel) return;
    if (document.fullscreenElement === panel) {
      if (document.exitFullscreen) await document.exitFullscreen();
    } else if (panel.requestFullscreen) {
      await panel.requestFullscreen();
    }
    renderStrobeControls();
    resizeStrobeCanvas();
  }

  function setStrobeMode(mode, { persist = true } = {}) {
    state.strobe.mode = mode === 'custom' ? 'custom' : 'sync';
    renderStrobeControls();
    if (persist) persistUiPreferences();
  }

  function setStrobeCustomHz(value, { persist = false, deferRender = false } = {}) {
    state.strobe.customHz = clampStrobeHz(value);
    if (deferRender) {
      markUiDirty('strobe');
      return;
    }
    renderStrobeControls();
    if (persist) persistUiPreferences();
  }

  function resizeStrobeCanvas() {
    const canvas = getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(160, Math.round(rect.width || 240));
    const height = Math.max(160, Math.round(rect.height || width));
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  function drawStrobeFrame(ts) {
    const canvas = getCanvas();
    const ctx = getContext(canvas);
    if (!canvas || !ctx) return;
    const now = typeof ts === 'number' ? ts : performance.now();
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#05060A';
    ctx.fillRect(0, 0, w, h);

    const pulse = state.strobe.active
      ? strobePhaseWindow(effectiveStrobeHz(), now)
      : { on: false, progress: 0 };
    const fill = pulse.on ? '#F6B96A' : '#11131A';
    const glow = pulse.on ? 0.75 : 0.12;
    const size = Math.min(w, h) * 0.48;
    const x = (w - size) / 2;
    const y = (h - size) / 2;

    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);
    gradient.addColorStop(0, `rgba(246, 185, 106, ${pulse.on ? 0.34 : 0.08})`);
    gradient.addColorStop(1, 'rgba(5, 6, 10, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = fill;
    ctx.shadowBlur = pulse.on ? 40 : 0;
    ctx.shadowColor = `rgba(246, 185, 106, ${glow})`;
    ctx.fillRect(x, y, size, size);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = pulse.on ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, size, size);
  }

  function handleFullscreenChange() {
    renderStrobeControls();
    resizeStrobeCanvas();
  }

  function bindStrobeEvents() {
    document.getElementById('btnStrobePlay')?.addEventListener('click', () => {
      setStrobeActive(true);
      renderStrobeControls();
      showToast(`estroboscopio → ${effectiveStrobeHz().toFixed(1)} Hz`);
    });
    document.getElementById('btnStrobeStop')?.addEventListener('click', () => {
      setStrobeActive(false);
      showToast('estroboscopio detenido');
    });
    document.getElementById('btnStrobeMini')?.addEventListener('click', toggleStrobeMini);
    document.getElementById('btnStrobeFullscreen')?.addEventListener('click', toggleStrobeFullscreen);
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
  }

  return {
    bindStrobeEvents,
    drawStrobeFrame,
    effectiveStrobeHz,
    handleFullscreenChange,
    renderStrobeControls,
    resizeStrobeCanvas,
    setStrobeActive,
    setStrobeCustomHz,
    setStrobeMode,
    setStrobePresentation,
    toggleStrobeFullscreen,
    toggleStrobeMini,
  };
}
