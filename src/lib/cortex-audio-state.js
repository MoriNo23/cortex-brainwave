import { AUDIO_KEYS, PRESET_PRESERVED_KEYS } from './cortex-config.js';
import { resolveAudioSnapshot } from './cortex-persistence.js';

export function createAudioStateController({
  state,
  engine,
  audioSnapshot,
  markUiDirty,
  syncUIFromState,
  updateBrain,
  showToast,
}) {
  function interpolateAudioState(from, to, progress) {
    const t = Math.max(0, Math.min(1, Number(progress) || 0));
    const source = audioSnapshot(from);
    const target = audioSnapshot(to);
    return Object.fromEntries(AUDIO_KEYS.map((key) => [key, source[key] + (target[key] - source[key]) * t]));
  }

  /* `preserve` lista claves del snapshot que no se aplican (el timeline excluye
     `mix`). Sin ella se aplica todo, que es lo que necesita el stop suave para
     bajar el volumen a propósito.
     `flush` escribe los sliders y readouts en el MISMO tick (syncUIFromState):
     para acciones puntuales del usuario (aplicar un preset) el DOM no puede
     esperar al rAF — cualquier lector del tick debe ver los valores nuevos.
     Sin flush, el coalescing por rAF sigue siendo el camino de las rampas. */
  function applyAudioState(snapshot, { label = null, toast = false, preserve = [], flush = false } = {}) {
    const next = audioSnapshot(snapshot);
    preserve.forEach((key) => { delete next[key]; });
    Object.assign(state, next);
    engine.updateBrainwave(state.brainwave);
    engine.updateCarrier(state.carrier);
    engine.updateModLevels();
    updateBrain();
    if (flush && typeof syncUIFromState === 'function') {
      syncUIFromState();
      markUiDirty('spatial');
    } else {
      // Sin syncUIFromState por llamada: durante una rampa esto se invoca por
      // tick y la UI va coalescida a una pasada por frame.
      markUiDirty('controls', 'spatial');
    }
    if (toast && label) showToast(label);
  }

  /* Aplicar un preset o un paso nunca cambia el volumen de salida y no deja la
     portadora en un valor inválido. El click sobre un preset es una acción
     puntual: estado, sliders y readouts quedan consistentes en el mismo tick. */
  function applyAudioSnapshot(snapshot, label = 'preset aplicado') {
    applyAudioState(resolveAudioSnapshot(snapshot, state), { label, toast: true, preserve: PRESET_PRESERVED_KEYS, flush: true });
  }

  return {
    applyAudioSnapshot,
    applyAudioState,
    interpolateAudioState,
  };
}
