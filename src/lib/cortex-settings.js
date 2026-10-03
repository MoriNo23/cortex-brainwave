export function createSettingsController({
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
}) {
  function renderStopControls() {
    state.stopBehavior = normalizeStopBehavior(state.stopBehavior);
    const select = document.getElementById('stopTargetBand');
    const input = document.getElementById('stopFadeSeconds');
    if (select) select.value = state.stopBehavior.targetBand;
    if (input) input.value = state.stopBehavior.fadeSeconds;
  }

  function loadUiPreferences() {
    try {
      const raw = JSON.parse(localStorage.getItem('cortex-settings') || '{}');
      Object.assign(state, restoreUiPreferences(raw));
    } catch (error) {
      Object.assign(state, restoreUiPreferences({}));
    }
  }

  function persistUiPreferences() {
    try {
      let raw = {};
      try {
        raw = JSON.parse(localStorage.getItem('cortex-settings')) || {};
      } catch (error) {
        raw = {};
      }
      Object.assign(raw, serializeUiPreferences(state));
      localStorage.setItem('cortex-settings', JSON.stringify(raw));
    } catch (error) {
      // sin localStorage: la preferencia vive en memoria
    }
  }

  function saveSettings() {
    const data = serializeSettings(state);
    localStorage.setItem('cortex-settings', JSON.stringify(data));
    showToast('ajustes guardados');
  }

  function loadSettings() {
    const raw = localStorage.getItem('cortex-settings');
    if (!raw) {
      showToast('no hay ajustes guardados');
      return false;
    }
    try {
      const data = restoreSettings(JSON.parse(raw));
      Object.assign(state, data);
      applyDockState();
      renderStopControls();
      renderStrobeControls();
      syncUIFromState();
      engine.updateBrainwave(state.brainwave);
      engine.updateCarrier(state.carrier);
      engine.updateModLevels();
      updateBrain();
      updateSpatialReadout();
      showToast('ajustes cargados');
      return true;
    } catch (error) {
      showToast('error al cargar');
      return false;
    }
  }

  function bindSettingsEvents() {
    document.getElementById('stopTargetBand')?.addEventListener('change', (event) => {
      state.stopBehavior.targetBand = normalizeStopBand(event.target.value);
      renderStopControls();
      persistUiPreferences();
    });
    document.getElementById('stopFadeSeconds')?.addEventListener('change', (event) => {
      state.stopBehavior.fadeSeconds = clampTransitionSeconds(event.target.value);
      renderStopControls();
      persistUiPreferences();
    });
    document.getElementById('btnSaveLocal')?.addEventListener('click', saveSettings);
    document.getElementById('btnLoadLocal')?.addEventListener('click', loadSettings);
    document.getElementById('btnSave')?.addEventListener('click', saveSettings);
    document.getElementById('btnLoad')?.addEventListener('click', loadSettings);
  }

  return {
    bindSettingsEvents,
    loadSettings,
    loadUiPreferences,
    persistUiPreferences,
    renderStopControls,
    saveSettings,
  };
}
