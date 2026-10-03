import { createStrobeController } from './cortex-strobe.js';

export function createStrobeStack({
  state,
  persistUiPreferences,
  showToast,
  markUiDirty,
}) {
  const strobeController = createStrobeController({
    state,
    persistUiPreferences,
    showToast,
    markUiDirty,
  });

  const {
    bindStrobeEvents,
    drawStrobeFrame,
    effectiveStrobeHz,
    handleFullscreenChange: handleStrobeFullscreenChange,
    renderStrobeControls,
    resizeStrobeCanvas,
    setStrobeActive,
    toggleStrobeFullscreen,
    toggleStrobeMini,
  } = strobeController;

  return {
    strobe: {
      bindStrobeEvents,
      drawStrobeFrame,
      effectiveStrobeHz,
      handleStrobeFullscreenChange,
      renderStrobeControls,
      resizeStrobeCanvas,
      setStrobeActive,
      toggleStrobeFullscreen,
      toggleStrobeMini,
    },
  };
}
