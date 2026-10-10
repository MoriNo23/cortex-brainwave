import { createTimelinePlayer } from './cortex-timeline-player.js';
import { createAppLifecycleController } from './cortex-app-lifecycle.js';

export function createRuntimeLifecycleStack({
  state,
  timelineState,
  runtimeState,
  engine,
  chrome,
  audio,
  timeline,
  settings,
  events,
}) {
  const { showToast, buildGlossary } = chrome;
  const {
    applyAudioState,
    applyAudioSnapshot,
    interpolateAudioState,
    startPlayback,
    setPlaybackUi,
    renderStrobeControls,
    resizeStrobeCanvas,
    resizeWave,
    setRadarStart,
    uiPulse,
    drawWaveFrame,
    drawRadarFrame,
    drawStrobeFrame,
    updateBrain,
    syncUIFromState,
    updateSpatialReadout,
    markUiDirty,
  } = audio;
  const {
    bindDockGestures,
    renderCustomPresets,
    applyDockState,
    renderTimeline,
    renderTimelinePicker,
    renderTransitionControls,
    updateDockPlayhead,
    refreshPlayheadGeometry,
    loadCustomPresetData,
    loadTimelineData,
    setTimelineStatus,
  } = timeline;
  const { renderStopControls, loadUiPreferences } = settings;
  const { bindEvents } = events;

  const appLifecycleController = createAppLifecycleController({
    runtimeState,
    engine,
    state,
    timelineState,
    createTimelinePlayer,
    renderTimeline,
    setTimelineStatus,
    applyAudioState,
    applyAudioSnapshot,
    interpolateAudioState,
    showToast,
    startPlayback,
    setPlaybackUi,
    buildGlossary,
    bindEvents,
    bindDockGestures,
    renderCustomPresets,
    applyDockState,
    renderTimelinePicker,
    renderTransitionControls,
    renderStopControls,
    renderStrobeControls,
    resizeStrobeCanvas,
    resizeWave,
    updateBrain,
    syncUIFromState,
    updateSpatialReadout,
    setRadarStart,
    uiPulse,
    drawWaveFrame,
    drawRadarFrame,
    drawStrobeFrame,
    updateDockPlayhead,
    refreshPlayheadGeometry,
    loadCustomPresetData,
    loadTimelineData,
    loadUiPreferences,
    markUiDirty,
  });

  return {
    lifecycle: {
      init: appLifecycleController.init,
    },
  };
}
