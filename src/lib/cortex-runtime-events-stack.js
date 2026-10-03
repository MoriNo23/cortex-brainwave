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
  });

  return {
    events: {
      bindEvents: appEventsController.bindEvents,
    },
  };
}
