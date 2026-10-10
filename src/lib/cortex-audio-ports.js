export function createTimelineAudioPorts({
  audioStack,
  persistUiPreferences,
}) {
  const { audioState, uiShell } = audioStack;

  return {
    ui: {
      persistUiPreferences,
      syncUIFromState: uiShell.syncUIFromState,
      clearBrainHighlight: uiShell.clearBrainHighlight,
      updateBrain: uiShell.updateBrain,
      updateSpatialReadout: uiShell.updateSpatialReadout,
      setText: uiShell.setText,
    },
    audio: {
      applyAudioSnapshot: audioState.applyAudioSnapshot,
      applyAudioState: audioState.applyAudioState,
      interpolateAudioState: audioState.interpolateAudioState,
    },
  };
}

export function createRuntimeAudioPorts({
  audioStack,
  startPlayback,
  setPlaybackUi,
}) {
  return {
    ...audioStack.audioState,
    ...audioStack.strobe,
    ...audioStack.uiShell,
    ...audioStack.visualizers,
    startPlayback,
    setPlaybackUi,
  };
}

export function createDebugAudioNamespaces(audioStack) {
  const { engine, audioState, strobe, uiShell, visualizers } = audioStack;

  return {
    audio: {
      engine,
      applyAudioSnapshot: audioState.applyAudioSnapshot,
      applyAudioState: audioState.applyAudioState,
      interpolateAudioState: audioState.interpolateAudioState,
      updateBrain: uiShell.updateBrain,
      updateSpatialReadout: uiShell.updateSpatialReadout,
    },
    ui: {
      syncUIFromState: uiShell.syncUIFromState,
      setText: uiShell.setText,
      writeReadouts: uiShell.writeReadouts,
      markUiDirty: uiShell.markUiDirty,
      applyBandInfo: uiShell.applyBandInfo,
      uiPulse: uiShell.uiPulse,
      getUiPasses: uiShell.getUiPasses,
      getRenderedBand: uiShell.getRenderedBand,
    },
    visualizers: {
      drawRadarFrame: visualizers.drawRadarFrame,
      drawWaveFrame: visualizers.drawWaveFrame,
      radarSize: visualizers.RADAR_SIZE,
      getRadarStart: visualizers.getRadarStart,
      getWavePhaseState: visualizers.getWavePhaseState,
    },
    strobe: {
      renderStrobeControls: strobe.renderStrobeControls,
      effectiveStrobeHz: strobe.effectiveStrobeHz,
      toggleStrobeFullscreen: strobe.toggleStrobeFullscreen,
      toggleStrobeFloating: strobe.toggleStrobeFloating,
      setStrobeActive: strobe.setStrobeActive,
      setStrobeMode: strobe.setStrobeMode,
      setStrobeCustomHz: strobe.setStrobeCustomHz,
      getFloatingInfo: strobe.getFloatingInfo,
      getPipCapability: strobe.getPipCapability,
    },
  };
}
