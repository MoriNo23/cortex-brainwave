import { createAudioEngine } from './cortex-audio-engine.js';
import { createAudioStateController } from './cortex-audio-state.js';

export function createAudioStateStack({
  state,
  audioSnapshot,
  markUiDirty,
  syncUIFromState,
  updateBrain,
  showToast,
}) {
  const engine = createAudioEngine({ state });

  const audioStateController = createAudioStateController({
    state,
    engine,
    audioSnapshot,
    markUiDirty,
    syncUIFromState,
    updateBrain,
    showToast,
  });

  const {
    applyAudioSnapshot,
    applyAudioState,
    interpolateAudioState,
  } = audioStateController;

  return {
    engine,
    audioState: {
      applyAudioSnapshot,
      applyAudioState,
      interpolateAudioState,
    },
  };
}
