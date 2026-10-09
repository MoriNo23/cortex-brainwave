export function createPresetController({
  state,
  bands,
  builtinPresets,
  presetDefaults,
  getCustomPresets,
  normalizeStopBand,
  audioSnapshot,
  bandFromFreq,
  syncUIFromState,
  updateBrain,
  updateSpatialReadout,
  engine,
  showToast,
}) {
  function stopTargetFrequency(band) {
    const preset = builtinPresets.find((item) => item.band === normalizeStopBand(band));
    return preset ? preset.freq : builtinPresets[2].freq;
  }

  function snapshotForBuiltin(preset) {
    return { ...audioSnapshot(), brainwave: preset.freq, ...presetDefaults[preset.band] };
  }

  function getPresetDefinition(id) {
    return builtinPresets.find((preset) => preset.id === id)
      || getCustomPresets().find((preset) => preset.id === id)
      || null;
  }

  function snapshotForPreset(id) {
    const preset = getPresetDefinition(id);
    if (!preset) return null;
    return preset.state ? { ...preset.state } : snapshotForBuiltin(preset);
  }

  function presetBand(preset) {
    return preset.state ? bandFromFreq(Number(preset.state.brainwave)) : preset.band;
  }

  function stopTargetSnapshot(source = state) {
    const snapshot = audioSnapshot(source);
    snapshot.brainwave = stopTargetFrequency(state.stopBehavior.targetBand);
    snapshot.mix = 0;
    return snapshot;
  }

  function stopTargetLabel() {
    return bands[normalizeStopBand(state.stopBehavior.targetBand)].name;
  }

  function applyPreset(band, freq) {
    state.brainwave = freq;

    const defaults = presetDefaults[band] || presetDefaults.alpha;
    state.amod = defaults.amod;
    state.binaural = defaults.binaural;
    state.stereo = defaults.stereo;
    state.fmod = defaults.fmod;
    state.noise = defaults.noise;

    syncUIFromState();
    engine.updateBrainwave(state.brainwave);
    engine.updateModLevels();
    updateBrain();
    updateSpatialReadout();
    showToast(`preset: ${bands[band].name}`);
  }

  return {
    applyPreset,
    getPresetDefinition,
    presetBand,
    snapshotForBuiltin,
    snapshotForPreset,
    stopTargetFrequency,
    stopTargetLabel,
    stopTargetSnapshot,
  };
}
