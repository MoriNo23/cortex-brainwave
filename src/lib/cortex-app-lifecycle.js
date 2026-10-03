export function createAppLifecycleController({
  runtimeState,
  engine,
  state,
  timelineState,
  createTimelinePlayer,
  renderTimeline,
  setTimelineStatus,
  applyAudioState,
  applyAudioSnapshot,
  interpolateAudioState,
  showToast,
  startPlayback,
  buildGlossary,
  bindEvents,
  bindDockGestures,
  renderCustomPresets,
  applyDockState,
  renderTimelinePicker,
  renderTransitionControls,
  renderStopControls,
  renderStrobeControls,
  resizeStrobeCanvas,
  resizeWave,
  updateBrain,
  syncUIFromState,
  updateSpatialReadout,
  setRadarStart,
  uiPulse,
  drawWaveFrame,
  drawRadarFrame,
  drawStrobeFrame,
  updateDockPlayhead,
  refreshPlayheadGeometry,
  loadCustomPresetData,
  loadTimelineData,
  loadUiPreferences,
  markUiDirty,
}) {
  function renderLoop(ts) {
    const now = typeof ts === 'number' ? ts : performance.now();
    uiPulse(now / 1000);
    drawWaveFrame(now);
    drawRadarFrame(now);
    drawStrobeFrame(now);
    updateDockPlayhead();
    requestAnimationFrame(renderLoop);
  }

  function handleResize() {
    refreshPlayheadGeometry();
    resizeStrobeCanvas();
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    if (runtimeState.timelinePlayer) runtimeState.timelinePlayer.syncOnVisible();
    refreshPlayheadGeometry();
    resizeStrobeCanvas();
    markUiDirty('readouts', 'spatial', 'band', 'strobe');
  }

  function init() {
    loadCustomPresetData();
    loadTimelineData();
    loadUiPreferences();
    runtimeState.timelinePlayer = createTimelinePlayer({
      engine,
      state,
      timelineState,
      renderTimeline,
      setTimelineStatus,
      applyAudioState,
      applyAudioSnapshot,
      interpolateAudioState,
      showToast,
      ensurePlaybackStarted: startPlayback,
    });
    buildGlossary();
    bindEvents();
    bindDockGestures();
    renderCustomPresets();
    applyDockState();
    renderTimeline();
    renderTimelinePicker();
    renderTransitionControls();
    renderStopControls();
    renderStrobeControls();
    resizeStrobeCanvas();
    resizeWave();
    updateBrain();
    syncUIFromState();
    updateSpatialReadout();
    setRadarStart(performance.now());
    requestAnimationFrame(renderLoop);
    uiPulse(0);

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  return {
    init,
    renderLoop,
  };
}
