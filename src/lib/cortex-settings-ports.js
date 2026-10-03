import { clampTransitionSeconds } from './cortex-persistence.js';

export function createDebugSettingsNamespace(settings) {
  const {
    saveSettings,
    loadSettings,
    loadUiPreferences,
    persistUiPreferences,
    renderStopControls,
  } = settings;

  return {
    settings: {
      saveSettings,
      loadSettings,
      loadUiPreferences,
      persistUiPreferences,
      renderStopControls,
      clampTransitionSeconds,
    },
  };
}
