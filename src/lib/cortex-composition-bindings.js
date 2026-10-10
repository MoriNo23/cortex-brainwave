import {
  createRuntimeAudioPorts,
  createTimelineAudioPorts,
} from './cortex-audio-ports.js';
import { createRuntimeTimelinePorts } from './cortex-timeline-ports.js';

export function createTimelineStackBindings({
  audioStack,
  bandFromFreq,
  audioSnapshot,
  normalizeCustomPresets,
  normalizeStopBand,
  clampTransitionSeconds,
  createId,
  escapeHtml,
  showToast,
  openDialog,
  closeDialog,
  persistUiPreferences,
}) {
  return {
    helpers: {
      createId,
      escapeHtml,
      bandFromFreq,
      audioSnapshot,
      normalizeCustomPresets,
      normalizeStopBand,
      clampTransitionSeconds,
    },
    chrome: {
      showToast,
      openDialog,
      closeDialog,
    },
    ...createTimelineAudioPorts({
      audioStack,
      persistUiPreferences,
    }),
  };
}

export function createRuntimeStackBindings({
  audioStack,
  timelineStack,
  showToast,
  buildGlossary,
  bindRegionInfoEvents,
  startPlayback,
  setPlaybackUi,
}) {
  return {
    chrome: {
      showToast,
      buildGlossary,
      bindRegionInfoEvents,
    },
    audio: createRuntimeAudioPorts({
      audioStack,
      startPlayback,
      setPlaybackUi,
    }),
    timeline: createRuntimeTimelinePorts(timelineStack),
  };
}
