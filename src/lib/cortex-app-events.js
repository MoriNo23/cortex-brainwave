export function createAppEventsController({
  state,
  timelineState,
  runtimeState,
  engine,
  markUiDirty,
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

  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && event.target.tagName !== 'INPUT') {
        event.preventDefault();
        document.getElementById('btnPlay').click();
      }
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
    document.getElementById('btnWav').addEventListener('click', exportWav);

    document.getElementById('toggleMods').addEventListener('click', () => {
      const body = document.getElementById('modsBody');
      const toggle = document.getElementById('toggleMods');
      const hidden = body.style.display === 'none';
      body.style.display = hidden ? 'block' : 'none';
      toggle.textContent = hidden ? '▼' : '▶';
    });

    bindRegionInfoEvents();
    document.addEventListener('fullscreenchange', handleStrobeFullscreenChange);
    bindKeyboardShortcuts();
  }

  return {
    bindEvents,
  };
}
