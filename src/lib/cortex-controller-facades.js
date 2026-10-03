export function createControllerFacades({
  getSettingsController,
}) {
  function requireSettingsController() {
    const controller = getSettingsController?.();
    if (!controller) throw new Error('settingsController is not ready');
    return controller;
  }

  function renderStopControls() {
    return requireSettingsController().renderStopControls();
  }

  function loadUiPreferences() {
    return requireSettingsController().loadUiPreferences();
  }

  function persistUiPreferences() {
    return requireSettingsController().persistUiPreferences();
  }

  function saveSettings() {
    return requireSettingsController().saveSettings();
  }

  function loadSettings() {
    return requireSettingsController().loadSettings();
  }

  return {
    loadSettings,
    loadUiPreferences,
    persistUiPreferences,
    renderStopControls,
    saveSettings,
  };
}
