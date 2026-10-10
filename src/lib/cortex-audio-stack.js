import { createAudioUiStack } from './cortex-audio-ui-stack.js';
import { createAudioStateStack } from './cortex-audio-state-stack.js';
import { createStrobeStack } from './cortex-strobe-stack.js';
import { createAudioVisualStack } from './cortex-audio-visual-stack.js';

export function createAudioStack({
  state,
  bandFromFreq,
  audioSnapshot,
  persistUiPreferences,
  showToast,
}) {
  let strobe;

  const uiStack = createAudioUiStack({
    state,
    bandFromFreq,
    getRenderStrobeControls: () => strobe?.renderStrobeControls?.(),
  });

  const { uiShell } = uiStack;
  const { markUiDirty, updateBrain } = uiShell;

  const stateStack = createAudioStateStack({
    state,
    audioSnapshot,
    markUiDirty,
    syncUIFromState: uiShell.syncUIFromState,
    updateBrain,
    showToast,
  });

  const strobeStack = createStrobeStack({
    state,
    persistUiPreferences,
    showToast,
    markUiDirty,
  });
  strobe = strobeStack.strobe;

  const visualStack = createAudioVisualStack({ state });

  return {
    engine: stateStack.engine,
    audioState: stateStack.audioState,
    strobe,
    uiShell,
    visualizers: visualStack.visualizers,
  };
}
