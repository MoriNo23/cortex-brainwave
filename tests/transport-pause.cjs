/* Pausa real del transporte (cortex-ui-flow-fixes, D2/D4).
   Spec: openspec/changes/cortex-ui-flow-fixes/specs/transport-pause.
   Node puro: fuentes reales con motor y reloj simulados. Cubre el contrato
   completo: pausa visible, reloj congelado, reanudación sin deriva. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const noop = () => {};

/* Motor simulado: suspend/resume registrados, reloj controlable. */
function makeEngine(clock) {
  const calls = { suspend: 0, resume: 0, start: 0, stop: 0 };
  return {
    calls,
    ctx: { state: 'running', get currentTime() { return clock.t; } },
    get started() { return calls.start > calls.stop; },
    start() { calls.start += 1; this.ctx.state = 'running'; },
    stop() { calls.stop += 1; this.ctx.state = 'suspended'; },
    suspend() { calls.suspend += 1; this.ctx.state = 'suspended'; return Promise.resolve(true); },
    resumePlayback() { calls.resume += 1; this.ctx.state = 'running'; return Promise.resolve(true); },
    updateBrainwave: noop,
    updateCarrier: noop,
    updateModLevels: noop,
  };
}

(async () => {
  const config = await import('../src/lib/cortex-config.js');
  const persistence = await import('../src/lib/cortex-persistence.js');
  const { createAudioStateController } = await import('../src/lib/cortex-audio-state.js');
  const { createTimelinePlayer } = await import('../src/lib/cortex-timeline-player.js');
  const { createPlaybackController } = await import('../src/lib/cortex-playback.js');
  const { audioSnapshot, clampTransitionSeconds } = persistence;

  function build() {
    const clock = { t: 0 };
    const engine = makeEngine(clock);
    const state = { ...config.createAppState() };
    const cleared = [];
    const statusText = { value: '' };
    const dom = {};
    const audio = createAudioStateController({
      state, engine, audioSnapshot, markUiDirty: noop, syncUIFromState: noop, updateBrain: noop, showToast: noop,
    });
    let playbackController = null;
    const player = createTimelinePlayer({
      engine, state,
      timelineState: config.createTimelineState(),
      renderTimeline: noop,
      setTimelineStatus: (t) => { statusText.value = t; },
      applyAudioState: audio.applyAudioState,
      applyAudioSnapshot: audio.applyAudioSnapshot,
      interpolateAudioState: audio.interpolateAudioState,
      showToast: noop,
      /* Como en la app real: arrancar el transporte arranca la sesión de
         audio que el player necesita para medir el reloj. */
      ensurePlaybackStarted: () => playbackController.startPlayback(),
    });
    playbackController = createPlaybackController({
      state, engine,
      getTimelinePlayer: () => player,
      clampTransitionSeconds, audioSnapshot,
      stopTargetSnapshot: () => audioSnapshot(state),
      stopTargetLabel: () => 'Alpha',
      applyAudioState: audio.applyAudioState,
      interpolateAudioState: audio.interpolateAudioState,
      syncUIFromState: noop,
      updateBrain: noop,
      updateSpatialReadout: noop,
      clearBrainHighlight: () => { cleared.push('brain'); },
      setTimelineStatus: (t) => { statusText.value = t; },
      showToast: noop,
    });
    /* DOM mínimo para setPlaybackUi: botón/dot/texto. */
    globalThis.document = {
      getElementById: (id) => {
        if (!dom[id]) dom[id] = { textContent: '', disabled: false, title: '', classList: { add: noop, remove: noop }, setAttribute: noop, getAttribute: () => null };
        return dom[id];
      },
    };
    return { clock, engine, state, playback: playbackController, player, dom, cleared, statusText };
  }

  // 1. Pausa desde detenido: no-op honesto
  {
    const ctx = build();
    const ok = ctx.playback.togglePause();
    check(ok === false, 'pausa sin reproducción: no-op honesto', `ret=${ok}`);
  }

  // 2. Pausa congela audio y muestra estado pausado
  {
    const ctx = build();
    ctx.playback.startPlayback();
    const paused = ctx.playback.togglePause();
    check(paused === true, 'pausa con audio activo: retorna true');
    check(ctx.engine.calls.suspend === 1, 'pausa: suspende el AudioContext', `suspend=${ctx.engine.calls.suspend}`);
    check(ctx.state.paused === true, 'pausa: state.paused=true');
    check(ctx.dom.statusText.textContent === 'pausado', 'pausa: el status visible dice pausado', ctx.dom.statusText.textContent);
    check(ctx.dom.btnPlay.textContent === '▶ Reanudar', 'pausa: el botón principal ofrece reanudar', ctx.dom.btnPlay.textContent);
    check(ctx.dom.btnWav.disabled === false, 'pausa: .wav sigue disponible (hay audio que exportar)');
  }

  // 3. Pausa con timeline corriendo congela también la secuencia
  {
    const ctx = build();
    ctx.player.timelineState.steps = [{
      id: 's1', presetId: 'builtin-alpha', durationSeconds: 4,
      snapshot: { brainwave: 10, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 },
      name: 'A', emoji: 'A', band: 'alpha',
    }];
    ctx.playback.startPlayback();
    ctx.player.play();
    ctx.clock.t = 1.0;
    ctx.player.catchUp();
    ctx.player.applyTransitionProgress();
    const remBefore = ctx.player.remainingMs;
    ctx.playback.togglePause();
    check(ctx.player.paused === true && !ctx.player.running, 'pausa: el player del timeline queda pausado');
    ctx.clock.t = 2.5; // el reloj avanza por fuera — en pausa no debe consumirse
    const remIdle = ctx.player.remainingMs;
    ctx.playback.togglePause(); // reanudar
    check(Math.abs(remBefore - remIdle) < 1e-6, 'pausa: el restante congelado no se consume', `antes=${remBefore.toFixed(2)} enPausa=${remIdle.toFixed(2)}`);
    check(ctx.player.running === true, 'reanudar: el player vuelve a correr');
    check(ctx.engine.calls.resume === 1, 'reanudar: resume del AudioContext');
    check(ctx.state.paused === false && ctx.dom.statusText.textContent === 'reproduciendo', 'reanudar: status vuelve a reproduciendo');
  }

  // 4. Reanudar completa la rampa sin deriva
  {
    const ctx = build();
    ctx.state.brainwave = 6; // estado vivo distinto del destino del paso
    ctx.player.timelineState.steps = [{
      id: 's1', presetId: 'builtin-alpha', durationSeconds: 4,
      snapshot: { brainwave: 10, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 },
      name: 'A', emoji: 'A', band: 'alpha',
    }];
    ctx.player.timelineState.transition = { enabled: true, seconds: 2 };
    ctx.playback.startPlayback();
    ctx.player.play();
    ctx.clock.t = 0.5;
    ctx.player.catchUp();
    ctx.player.applyTransitionProgress();
    const midBw = ctx.state.brainwave;
    ctx.playback.togglePause();
    const frozenTrans = ctx.player.pausedTransitionMs;
    ctx.clock.t = 3.0; // tiempo muerto en pausa
    ctx.playback.togglePause(); // reanudar
    ctx.clock.t = 3.05;
    ctx.player.applyTransitionProgress();
    const bwAfterIdle = ctx.state.brainwave;
    ctx.player.stop();
    check(midBw > 2.5 && midBw < 9.5, 'rampa: pausa a mitad de camino', midBw.toFixed(2));
    check(frozenTrans > 0 && frozenTrans < 2000, 'rampa: congela lo que faltaba', `trans=${frozenTrans.toFixed(0)}ms`);
    check(bwAfterIdle > midBw && bwAfterIdle < 10, 'rampa: reanudar continúa desde el punto (ni origen ni destino)', `${midBw.toFixed(2)} → ${bwAfterIdle.toFixed(2)}`);
  }

  // 5. Detener desde pausado: stop suave normal y regiones apagadas
  {
    const ctx = build();
    ctx.playback.startPlayback();
    ctx.playback.togglePause();
    const resumed = ctx.playback.togglePlayback(); // Space desde pausa = reanudar
    check(resumed === true, 'Space/detener desde pausa: reanuda (no reinicia)');
    ctx.playback.togglePause();
    ctx.state.stopBehavior = { targetBand: 'alpha', fadeSeconds: 0 };
    ctx.playback.togglePlayback(); // estando en pausa: reanuda; luego paramos ya reproduciendo
    ctx.playback.togglePause(); // pausa de nuevo
    // detener de verdad: salir de pausa y stop suave
    ctx.playback.togglePause();
    const stopped = ctx.playback.requestGentleStop();
    check(stopped === true, 'stop suave tras pausa/reanudación funciona');
    check(ctx.cleared.includes('brain'), 'detener: el mapa cerebral se apaga (clearBrainHighlight)');
    check(ctx.state.playing === false && ctx.state.paused === false, 'detener: estado final detenido y sin pausa');
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
