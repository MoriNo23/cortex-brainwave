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
    getFloatingInfo,
    getPipCapability,
    handleFullscreenChange: handleStrobeFullscreenChange,
    renderStrobeControls,
    resizeStrobeCanvas,
    setStrobeActive,
    setStrobeCustomHz,
    setStrobeMode,
    toggleStrobeFloating,
    toggleStrobeFullscreen,
  } = strobeController;

  return {
    strobe: {
      bindStrobeEvents,
      drawStrobeFrame,
      effectiveStrobeHz,
      getFloatingInfo,
      getPipCapability,
      handleStrobeFullscreenChange,
      renderStrobeControls,
      resizeStrobeCanvas,
      setStrobeActive,
      setStrobeCustomHz,
      setStrobeMode,
      toggleStrobeFloating,
      toggleStrobeFullscreen,
    },
  };
}
