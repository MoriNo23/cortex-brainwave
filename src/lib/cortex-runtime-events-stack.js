import { createAppEventsController } from './cortex-app-events.js';

export function createRuntimeEventsStack({
  state,
  timelineState,
  runtimeState,
  engine,
  chrome,
  audio,
  timeline,
  settings,
  wav,
}) {
  const { bindRegionInfoEvents } = chrome;
  const {
    markUiDirty,
    updateBrain,
    bindStrobeEvents,
    handleStrobeFullscreenChange,
  } = audio;
  const {
    toggleDock,
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
    togglePause,
    togglePlayback,
  } = timeline;
  const { bindSettingsEvents } = settings;
  const { exportWav } = wav;

  const appEventsController = createAppEventsController({
    state,
    timelineState,
    runtimeState,
    engine,
    markUiDirty,
    /* Faltaba: el handler del slider Brainwave llama a updateBrain() y no estaba
       ni en los parámetros del controlador ni aquí. Arrastrar Brainwave lanzaba
       ReferenceError y el panel de banda, el mapa cerebral y los readouts se
       quedaban en la banda anterior. */
    updateBrain,
    toggleDock,
    togglePause,
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
  });

  return {
    events: {
      bindEvents: appEventsController.bindEvents,
    },
  };
}
