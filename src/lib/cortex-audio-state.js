import { AUDIO_KEYS } from './cortex-config.js';

export function createAudioStateController({
  state,
  engine,
  audioSnapshot,
  markUiDirty,
  updateBrain,
  showToast,
}) {
  function interpolateAudioState(from, to, progress) {
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const source = audioSnapshot(from);
    const target = audioSnapshot(to);
    return Object.fromEntries(AUDIO_KEYS.map((key) => [key, source[key] + (target[key] - source[key]) * t]));
  }

  function applyAudioState(snapshot, { label = null, toast = false } = {}) {
    Object.assign(state, audioSnapshot(snapshot));
    engine.updateBrainwave(state.brainwave);
    engine.updateCarrier(state.carrier);
    engine.updateModLevels();
    updateBrain();
    // Sin syncUIFromState por llamada: durante una rampa esto se invoca por tick
    // y la UI va coalescida a una pasada por frame.
    markUiDirty('controls', 'spatial');
    if (toast && label) showToast(label);
  }

  function applyAudioSnapshot(snapshot, label = 'preset aplicado') {
    applyAudioState(snapshot, { label, toast: true });
  }

  return {
    applyAudioSnapshot,
    applyAudioState,
    interpolateAudioState,
  };
}
