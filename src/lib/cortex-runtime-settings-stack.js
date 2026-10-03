import {
  clampTransitionSeconds,
  normalizeStopBand,
  normalizeStopBehavior,
  restoreSettings,
  restoreUiPreferences,
  serializeSettings,
  serializeUiPreferences,
} from './cortex-persistence.js';
import { createSettingsController } from './cortex-settings.js';
import { createWavExporter } from './cortex-wav-export.js';

export function createRuntimeSettingsStack({
  state,
  engine,
  chrome,
  audio,
  timeline,
}) {
  const { showToast } = chrome;
  const {
    renderStrobeControls,
    syncUIFromState,
    updateBrain,
    updateSpatialReadout,
  } = audio;
  const { applyDockState } = timeline;

  const settingsController = createSettingsController({
    state,
    engine,
    normalizeStopBehavior,
    normalizeStopBand,
    clampTransitionSeconds,
    restoreUiPreferences,
    serializeUiPreferences,
    restoreSettings,
    serializeSettings,
    applyDockState,
    renderStrobeControls,
    syncUIFromState,
    updateBrain,
    updateSpatialReadout,
    showToast,
  });

  const wavExporter = createWavExporter({ state, showToast });
  const { exportWav } = wavExporter;

  return {
    settingsController,
    settings: {
      bindSettingsEvents: settingsController.bindSettingsEvents,
      loadUiPreferences: settingsController.loadUiPreferences,
      renderStopControls: settingsController.renderStopControls,
    },
    wav: {
      exportWav,
    },
  };
}
