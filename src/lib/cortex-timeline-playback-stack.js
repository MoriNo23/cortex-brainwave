import { createPlaybackController } from './cortex-playback.js';

export function createTimelinePlaybackStack({
  state,
  runtimeState,
  engine,
  helpers,
  chrome,
  ui,
  audio,
  preset,
  support,
}) {
  const { clampTransitionSeconds, audioSnapshot } = helpers;
  const { showToast } = chrome;
  const { syncUIFromState, updateBrain, updateSpatialReadout } = ui;
  const { applyAudioState, interpolateAudioState } = audio;
  const { stopTargetSnapshot, stopTargetLabel } = preset;
  const { setTimelineStatus } = support;

  const playbackController = createPlaybackController({
    state,
    engine,
    getTimelinePlayer: () => runtimeState.timelinePlayer,
    clampTransitionSeconds,
    audioSnapshot,
    stopTargetSnapshot,
    stopTargetLabel,
    applyAudioState,
    interpolateAudioState,
    syncUIFromState,
    updateBrain,
    updateSpatialReadout,
    setTimelineStatus,
    showToast,
  });

  const {
    requestGentleStop,
    startPlayback,
    togglePlayback,
  } = playbackController;

  return {
    playback: {
      requestGentleStop,
      startPlayback,
      togglePlayback,
    },
  };
}
