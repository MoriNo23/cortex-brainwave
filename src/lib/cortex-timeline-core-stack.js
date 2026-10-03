import {
  BANDS,
  BUILTIN_PRESETS,
  PRESET_DEFAULTS,
} from './cortex-config.js';
import { createTimelineSupportController } from './cortex-timeline-support.js';
import { createPresetController } from './cortex-presets.js';
import { createTimelineUiController } from './cortex-timeline-ui.js';

export function createTimelineCoreStack({
  state,
  timelineState,
  uiState,
  runtimeState,
  engine,
  getCustomPresets,
  helpers,
  chrome,
  ui,
  audio,
}) {
  const {
    createId,
    escapeHtml,
    bandFromFreq,
    audioSnapshot,
    normalizeStopBand,
  } = helpers;
  const { showToast } = chrome;
  const {
    persistUiPreferences,
    syncUIFromState,
    updateBrain,
    updateSpatialReadout,
    setText,
  } = ui;
  const { applyAudioSnapshot } = audio;

  const timelineSupportController = createTimelineSupportController({
    timelineState,
    createId,
    setText,
  });

  const {
    durationHint,
    durationInputConfig,
    durationToSeconds,
    loadTimelineData,
    normalizeDurationUnit,
    persistTimeline,
    secondsToDuration,
    setTimelineStatus,
  } = timelineSupportController;

  const presetController = createPresetController({
    state,
    bands: BANDS,
    builtinPresets: BUILTIN_PRESETS,
    presetDefaults: PRESET_DEFAULTS,
    getCustomPresets,
    normalizeStopBand,
    audioSnapshot,
    bandFromFreq,
    syncUIFromState,
    updateBrain,
    updateSpatialReadout,
    engine,
    showToast,
  });

  const {
    applyPreset,
    getPresetDefinition,
    presetBand,
    snapshotForPreset,
    stopTargetLabel,
    stopTargetSnapshot,
  } = presetController;

  const timelineUiController = createTimelineUiController({
    state,
    timelineState,
    uiState,
    builtinPresets: BUILTIN_PRESETS,
    getCustomPresets,
    getPresetDefinition,
    snapshotForPreset,
    presetBand,
    createId,
    escapeHtml,
    normalizeDurationUnit,
    durationInputConfig,
    durationHint,
    secondsToDuration,
    persistTimeline,
    persistUiPreferences,
    applyAudioSnapshot,
    getTimelinePlayer: () => runtimeState.timelinePlayer,
  });

  return {
    preset: {
      applyPreset,
      getPresetDefinition,
      presetBand,
      snapshotForPreset,
      stopTargetLabel,
      stopTargetSnapshot,
    },
    support: {
      durationHint,
      durationInputConfig,
      durationToSeconds,
      loadTimelineData,
      normalizeDurationUnit,
      persistTimeline,
      secondsToDuration,
      setTimelineStatus,
    },
    timelineUi: timelineUiController,
  };
}
