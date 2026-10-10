export function createPlaybackController({
  state,
  engine,
  getTimelinePlayer,
  clampTransitionSeconds,
  audioSnapshot,
  stopTargetSnapshot,
  stopTargetLabel,
  applyAudioState,
  interpolateAudioState,
  syncUIFromState,
  updateBrain,
  updateSpatialReadout,
  setTimelineStatus,
  showToast,
}) {
  const gentleStop = {
    active: false,
    frame: 0,
    startedAtMs: 0,
    durationMs: 0,
    sourceState: null,
    targetState: null,
    restoreMix: 0,
    timelineStatusText: null,
    timer: 0,
  };

  function setTimelineTransportDisabled(disabled) {
    ['btnTimelinePlay', 'btnTimelinePause', 'btnTimelineStop', 'btnTimelineClear'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = disabled;
    });
  }

  /* La exportación .wav renderiza lo que suena: sin reproducción no hay señal.
     El botón se deshabilita y expone su razón sin que haya que probarlo
     (tarea 5.6 de cortex-fresh-start). */
  function refreshWavButton(ready) {
    const btn = document.getElementById('btnWav');
    if (!btn) return;
    btn.disabled = !ready;
    const reason = ready
      ? 'Exportar 60 s de lo que suena a .wav'
      : 'Necesita audio reproduciéndose: exporta lo que suena';
    btn.title = reason;
    btn.setAttribute('aria-label', reason);
  }

  function setPlaybackUi(mode) {
    const btn = document.getElementById('btnPlay');
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (!btn || !dot || !text) return;
    refreshWavButton(mode === 'playing');
    if (mode === 'playing') {
      btn.disabled = false;
      btn.textContent = '■ Detener';
      btn.classList.remove('primary');
      dot.classList.add('on');
      text.textContent = 'reproduciendo';
      setTimelineTransportDisabled(false);
      return;
    }
    if (mode === 'stopping') {
      btn.disabled = true;
      btn.textContent = '■ Deteniendo…';
      btn.classList.remove('primary');
      dot.classList.add('on');
      text.textContent = 'deteniendo suave';
      setTimelineTransportDisabled(true);
      return;
    }
    btn.disabled = false;
    btn.textContent = '▶ Iniciar';
    btn.classList.add('primary');
    dot.classList.remove('on');
    text.textContent = 'detenido';
    setTimelineTransportDisabled(false);
  }

  function finishGentleStop() {
    if (gentleStop.frame) cancelAnimationFrame(gentleStop.frame);
    if (gentleStop.timer) clearTimeout(gentleStop.timer);
    const targetState = gentleStop.targetState ? { ...gentleStop.targetState } : stopTargetSnapshot();
    const restoreMix = gentleStop.restoreMix;
    const timelineStatusText = gentleStop.timelineStatusText;
    gentleStop.active = false;
    gentleStop.frame = 0;
    gentleStop.timer = 0;
    gentleStop.startedAtMs = 0;
    gentleStop.durationMs = 0;
    gentleStop.sourceState = null;
    gentleStop.targetState = null;
    gentleStop.restoreMix = 0;
    gentleStop.timelineStatusText = null;
    engine.stop();
    state.playing = false;
    Object.assign(state, targetState, { mix: restoreMix });
    syncUIFromState();
    updateBrain();
    updateSpatialReadout();
    setPlaybackUi('stopped');
    if (timelineStatusText) setTimelineStatus(timelineStatusText);
    showToast(`detenido suave → ${stopTargetLabel()}`);
  }

  function runGentleStopFrame() {
    if (!gentleStop.active) return;
    // Puede llegar desde el respaldo por temporizador: no dejar dos cadenas de frames.
    if (gentleStop.frame) cancelAnimationFrame(gentleStop.frame);
    gentleStop.frame = 0;
    const progress = gentleStop.durationMs === 0
      ? 1
      : Math.min(1, Math.max(0, (performance.now() - gentleStop.startedAtMs) / gentleStop.durationMs));
    applyAudioState(interpolateAudioState(gentleStop.sourceState, gentleStop.targetState, progress));
    if (progress >= 1) {
      finishGentleStop();
      return;
    }
    gentleStop.frame = requestAnimationFrame(runGentleStopFrame);
  }

  function requestGentleStop({ stopTimeline = false } = {}) {
    const timelinePlayer = getTimelinePlayer ? getTimelinePlayer() : null;
    const timelineWasActive = Boolean(timelinePlayer && (timelinePlayer.running || timelinePlayer.paused));
    if (timelineWasActive) timelinePlayer.stop();
    if (!state.playing || gentleStop.active) return false;

    const targetLabel = stopTargetLabel();
    const sourceState = audioSnapshot(state);
    const durationMs = clampTransitionSeconds(state.stopBehavior.fadeSeconds) * 1000;
    gentleStop.active = true;
    gentleStop.frame = 0;
    gentleStop.startedAtMs = performance.now();
    gentleStop.durationMs = durationMs;
    gentleStop.sourceState = sourceState;
    gentleStop.targetState = stopTargetSnapshot(sourceState);
    gentleStop.restoreMix = sourceState.mix;
    gentleStop.timelineStatusText = (timelineWasActive || stopTimeline)
      ? `Timeline detenido suavemente en ${targetLabel}.`
      : null;

    setPlaybackUi('stopping');
    if (timelineWasActive || stopTimeline) setTimelineStatus(`Deteniendo suavemente hacia ${targetLabel}…`);

    if (!engine.started || durationMs === 0) {
      applyAudioState(gentleStop.targetState);
      finishGentleStop();
      return true;
    }
    runGentleStopFrame();
    // Con la pestaña oculta requestAnimationFrame no corre y el stop suave
    // quedaría a medias con el volumen a mitad de camino. Un temporizador lo remata.
    if (gentleStop.active) gentleStop.timer = setTimeout(runGentleStopFrame, durationMs + 100);
    return true;
  }

  function startPlayback() {
    if (gentleStop.active) return false;
    if (!state.playing) {
      engine.start();
      state.playing = true;
    }
    setPlaybackUi('playing');
    engine.updateBrainwave(state.brainwave);
    engine.updateCarrier(state.carrier);
    engine.updateModLevels();
    updateBrain();
    return true;
  }

  function togglePlayback() {
    if (state.playing) return requestGentleStop();
    return startPlayback();
  }

  return {
    requestGentleStop,
    setPlaybackUi,
    startPlayback,
    togglePlayback,
  };
}
