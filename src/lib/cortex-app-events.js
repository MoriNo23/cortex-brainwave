/* Guardas de foco de los atajos de teclado (tarea 5.7 de cortex-fresh-start).
   A nivel de módulo y exportadas para que el unitario (tests/keyboard-shortcuts.cjs)
   las ejercite con DOM simulado sin montar la app: la garantía que se verifica
   es la guarda — con el foco en un input la tecla escribe y no dispara
   transporte. */
const INTERACTIVE_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);

export function isInteractiveTarget(target) {
  if (!target || target.nodeType !== 1) return false;
  if (INTERACTIVE_TAGS.has(target.tagName)) return true;
  return target.isContentEditable === true;
}

export function bindKeyboardShortcuts({ getButton = (id) => document.getElementById(id), toggleDock = null } = {}) {
  document.addEventListener('keydown', (event) => {
    /* Guardas de foco: con el foco en un control interactivo la tecla
       pertenece a ESE control — escribe, activa, no dispara transporte. */
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isInteractiveTarget(event.target)) return;

    if (event.code === 'Space') {
      /* Espacio: iniciar/detener, lo mismo que el botón visible ▶ Iniciar. */
      event.preventDefault();
      getButton('btnPlay')?.click();
      return;
    }
    if (event.code === 'KeyP') {
      /* P: pausar/reanudar el timeline (botón visible Ⅱ Pausar). */
      event.preventDefault();
      getButton('btnTimelinePause')?.click();
      return;
    }
    if (event.code === 'BracketLeft') {
      /* [: paso anterior del timeline (botón visible ◀ del inspector). */
      event.preventDefault();
      getButton('inspectorMoveUp')?.click();
      return;
    }
    if (event.code === 'BracketRight') {
      /* ]: paso siguiente del timeline (botón visible ▶ del inspector). */
      event.preventDefault();
      getButton('inspectorMoveDown')?.click();
      return;
    }
    if (event.code === 'KeyT') {
      /* T: plegar/desplegar el timeline (equivalente al botón visible
         ⌁ Timeline del panel de sonido). */
      event.preventDefault();
      if (typeof toggleDock === 'function') toggleDock();
      return;
    }
  });
}

export function createAppEventsController({
  state,
  timelineState,
  runtimeState,
  engine,
  markUiDirty,
  updateBrain,
  toggleDock,
  bindStrobeEvents,
  bindSettingsEvents,
  bindCustomPresetEvents,
  persistTimeline,
  setTimelineStatus,
  renderTransitionControls,
  durationToSeconds,
  setDurationUnit,
  requestGentleStop,
  clearTimeline,
  selectedStepIndex,
  renderTimeline,
  updateSelectedStepDuration,
  applySelectedStep,
  moveSelectedStep,
  duplicateSelectedStep,
  removeSelectedStep,
  applyPreset,
  togglePlayback,
  exportWav,
  bindRegionInfoEvents,
  handleStrobeFullscreenChange,
}) {
  function refreshTimelineTransition() {
    if (runtimeState.timelinePlayer) runtimeState.timelinePlayer.refreshTransition();
  }

  function bindMod(id, key) {
    const element = document.getElementById(id);
    element.addEventListener('input', () => {
      state[key] = parseFloat(element.value);
      engine.updateModLevels();
      markUiDirty('readouts', 'spatial');
    });
  }

  function bindTimelineControls() {
    document.getElementById('timelineLoop').addEventListener('change', (event) => {
      timelineState.loop = event.target.checked;
      persistTimeline();
      setTimelineStatus(timelineState.loop ? 'Loop infinito activado.' : 'Loop infinito desactivado.');
    });

    document.getElementById('timelineTransitionEnabled').addEventListener('change', (event) => {
      timelineState.transition.enabled = event.target.checked;
      persistTimeline();
      renderTransitionControls();
      refreshTimelineTransition();
    });

    document.getElementById('timelineTransitionSeconds').addEventListener('change', () => {
      const input = document.getElementById('timelineTransitionSeconds');
      const seconds = durationToSeconds(input.value, timelineState.durationUnits.transition, 'transition');
      timelineState.transition.seconds = seconds === null ? timelineState.transition.seconds : seconds;
      persistTimeline();
      renderTransitionControls();
      refreshTimelineTransition();
    });

    document.querySelectorAll('#timelineDock [data-duration-unit-context="transition"]').forEach((button) => {
      button.addEventListener('click', () => setDurationUnit('transition', button.dataset.unit));
    });
    document.querySelectorAll('#timelineDock [data-duration-unit-context="step"]').forEach((button) => {
      button.addEventListener('click', () => setDurationUnit('step', button.dataset.unit));
    });

    document.getElementById('btnTimelinePlay').addEventListener('click', () => runtimeState.timelinePlayer.play());
    document.getElementById('btnTimelinePause').addEventListener('click', () => runtimeState.timelinePlayer.pause());
    document.getElementById('btnTimelineStop').addEventListener('click', () => {
      if (!state.playing) {
        runtimeState.timelinePlayer.stop();
        return;
      }
      requestGentleStop({ stopTimeline: true });
    });
    document.getElementById('btnTimelineClear').addEventListener('click', clearTimeline);
  }

  function bindInspectorControls() {
    document.getElementById('inspectorDuration').addEventListener('change', () => {
      const index = selectedStepIndex();
      if (index === null) return;
      const input = document.getElementById('inspectorDuration');
      const seconds = durationToSeconds(input.value, timelineState.durationUnits.step, 'step');
      if (seconds === null) {
        renderTimeline();
        return;
      }
      updateSelectedStepDuration(seconds);
    });
    document.getElementById('inspectorApply').addEventListener('click', applySelectedStep);
    document.getElementById('inspectorMoveUp').addEventListener('click', () => moveSelectedStep(-1));
    document.getElementById('inspectorMoveDown').addEventListener('click', () => moveSelectedStep(1));
    document.getElementById('inspectorDuplicate').addEventListener('click', duplicateSelectedStep);
    document.getElementById('inspectorRemove').addEventListener('click', removeSelectedStep);
  }

  function bindPresetCards() {
    document.querySelectorAll('.preset').forEach((element) => {
      element.addEventListener('click', () => applyPreset(element.dataset.band, parseFloat(element.dataset.freq)));
    });
  }

  function bindEvents() {
    const brainwaveSlider = document.getElementById('sliderBrainwave');
    brainwaveSlider.addEventListener('input', () => {
      state.brainwave = parseFloat(brainwaveSlider.value);
      engine.updateBrainwave(state.brainwave);
      updateBrain();
    });

    const carrierSlider = document.getElementById('sliderCarrier');
    carrierSlider.addEventListener('input', () => {
      state.carrier = parseFloat(carrierSlider.value);
      engine.updateCarrier(state.carrier);
      markUiDirty('readouts');
    });

    bindMod('sliderAmod', 'amod');
    bindMod('sliderBinaural', 'binaural');
    bindMod('sliderStereo', 'stereo');
    bindMod('sliderFmod', 'fmod');
    bindMod('sliderNoise', 'noise');
    bindMod('sliderMix', 'mix');

    document.getElementById('btnOpenTimeline').addEventListener('click', toggleDock);
    bindStrobeEvents();
    bindSettingsEvents();
    bindCustomPresetEvents();
    bindTimelineControls();
    bindInspectorControls();
    bindPresetCards();

    document.getElementById('btnPlay').addEventListener('click', togglePlayback);
    document.getElementById('btnWav').addEventListener('click', () => {
      if (state.playing) exportWav();
    });

    document.getElementById('toggleMods').addEventListener('click', () => {
      const body = document.getElementById('modsBody');
      const toggle = document.getElementById('toggleMods');
      const hidden = body.dataset.folded === 'true';
      body.dataset.folded = hidden ? 'false' : 'true';
      toggle.textContent = hidden ? '▼' : '▶';
      toggle.setAttribute('aria-expanded', hidden ? 'true' : 'false');
    });

    bindRegionInfoEvents();
    document.addEventListener('fullscreenchange', handleStrobeFullscreenChange);
    bindKeyboardShortcuts({ toggleDock });
  }

  return {
    bindEvents,
  };
}
