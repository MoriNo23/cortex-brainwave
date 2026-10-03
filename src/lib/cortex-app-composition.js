import {
  audioSnapshot,
  clampTransitionSeconds,
  normalizeCustomPresets,
  normalizeStopBand,
} from './cortex-persistence.js';
import { createUiSession } from './cortex-session.js';
import { createChromeStack } from './cortex-chrome-stack.js';
import { createDebugStack } from './cortex-debug-stack.js';
import {
  createRuntimeStackBindings,
  createTimelineStackBindings,
} from './cortex-composition-bindings.js';
import { createAudioStack } from './cortex-audio-stack.js';
import { createTimelineStack } from './cortex-timeline-stack.js';
import { createAppRuntimeStack } from './cortex-app-runtime-stack.js';
import { createId, escapeHtml } from './cortex-dom-utils.js';
import { bandFromFreq as deriveBandFromFreq } from './core-math.js';

export function createCortexApp() {
  const session = createUiSession();
  const state = session.state;
  const timelineState = session.timelineState;
  const uiState = session.ui;
  const runtimeState = session.runtime;
  let settingsController;

  const chromeStack = createChromeStack({
    getSettingsController: () => settingsController,
  });
  const { chrome, settings } = chromeStack;

  const bandFromFreq = deriveBandFromFreq;

  const audioStack = createAudioStack({
    state,
    bandFromFreq,
    audioSnapshot,
    persistUiPreferences: settings.persistUiPreferences,
    showToast: chrome.showToast,
  });

  const timelineStack = createTimelineStack({
    session,
    state,
    timelineState,
    uiState,
    runtimeState,
    engine: audioStack.engine,
    ...createTimelineStackBindings({
      audioStack,
      bandFromFreq,
      audioSnapshot,
      normalizeCustomPresets,
      normalizeStopBand,
      clampTransitionSeconds,
      createId,
      escapeHtml,
      showToast: chrome.showToast,
      openDialog: chrome.openDialog,
      closeDialog: chrome.closeDialog,
      persistUiPreferences: settings.persistUiPreferences,
    }),
  });

  const runtimeStack = createAppRuntimeStack({
    state,
    timelineState,
    runtimeState,
    engine: audioStack.engine,
    ...createRuntimeStackBindings({
      audioStack,
      timelineStack,
      showToast: chrome.showToast,
      buildGlossary: chrome.buildGlossary,
      bindRegionInfoEvents: chrome.bindRegionInfoEvents,
      startPlayback: timelineStack.playback.startPlayback,
    }),
  });

  settingsController = runtimeStack.settingsController;

  const debugStack = createDebugStack({
    state,
    timelineState,
    runtimeState,
    bandFromFreq,
    audioStack,
    timelineStack,
    settings: {
      ...settings,
      getCustomPresets: timelineStack.customPresets.getCustomPresets,
    },
  });

  return {
    init: runtimeStack.lifecycle.init,
    mountDebugSurface: debugStack.mountDebugSurface,
  };
}
