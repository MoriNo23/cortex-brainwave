import { BANDS } from './cortex-config.js';
import { createUiShellController } from './cortex-ui-shell.js';

export function createAudioUiStack({
  state,
  bandFromFreq,
  getRenderStrobeControls,
}) {
  const uiShellController = createUiShellController({
    state,
    bands: BANDS,
    bandFromFreq,
    renderStrobeControls: () => getRenderStrobeControls(),
  });

  const {
    applyBandInfo,
    getRenderedBand,
    getUiPasses,
    markUiDirty,
    setText,
    syncUIFromState,
    uiPulse,
    updateBrain,
    updateSpatialReadout,
    writeReadouts,
    writeSliders,
  } = uiShellController;

  return {
    uiShell: {
      applyBandInfo,
      getRenderedBand,
      getUiPasses,
      markUiDirty,
      setText,
      syncUIFromState,
      uiPulse,
      updateBrain,
      updateSpatialReadout,
      writeReadouts,
      writeSliders,
    },
  };
}
