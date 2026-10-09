/* Integridad del volumen (mix) y la portadora (carrier) frente al timeline y el stop suave.
   Spec: openspec/changes/fix-timeline-mix-reset/specs/audio-mix-integrity/spec.md
   Node puro: sin navegador y sin npm install. Importa el fuente real de src/lib con un
   motor de audio y un reloj simulados, igual que tests/strobe-worker.cjs hace con el Worker. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const noop = () => {};

function makeEngine() {
  const carriers = [];
  return {
    ctx: { state: 'running', currentTime: 0 },
    started: true,
    carriers,
    updateBrainwave: noop,
    updateCarrier(freq) { carriers.push(freq); },
    updateModLevels: noop,
    stop() { this.started = false; },
  };
}

(async () => {
  const config = await import('../src/lib/cortex-config.js');
  const persistence = await import('../src/lib/cortex-persistence.js');
  const { bandFromFreq } = await import('../src/lib/core-math.js');
  const { createPresetController } = await import('../src/lib/cortex-presets.js');
  const { createAudioStateController } = await import('../src/lib/cortex-audio-state.js');
  const { createTimelinePlayer } = await import('../src/lib/cortex-timeline-player.js');
  const { createPlaybackController } = await import('../src/lib/cortex-playback.js');
  const { audioSnapshot, clampTransitionSeconds, normalizeStopBand, normalizeTimelineStorage } = persistence;

  function build({ mix = 80, carrier = 200 } = {}) {
    const state = { ...config.createAppState(), mix, carrier, playing: true };
    const engine = makeEngine();
    const audio = createAudioStateController({
      state, engine, audioSnapshot, markUiDirty: noop, updateBrain: noop, showToast: noop,
    });
    const preset = createPresetController({
      state, bands: config.BANDS, builtinPresets: config.BUILTIN_PRESETS, presetDefaults: config.PRESET_DEFAULTS,
      getCustomPresets: () => [], normalizeStopBand, audioSnapshot, bandFromFreq,
      syncUIFromState: noop, updateBrain: noop, updateSpatialReadout: noop, engine, showToast: noop,
    });
    return { state, engine, audio, preset };
  }

  // Datos con el defecto anterior: un paso builtin guardado con carrier 0 y mix 0.
  const legacyStep = (id, bw) => ({
    id, presetId: 'builtin-x', durationSeconds: 2, name: id, emoji: 'x', band: 'alpha',
    snapshot: { brainwave: bw, carrier: 0, amod: 30, binaural: 20, stereo: 0, fmod: 0, noise: 10, mix: 0 },
  });

  function makePlayer(ctx, { transition }) {
    const timelineState = config.createTimelineState();
    timelineState.steps = [legacyStep('s1', 2), legacyStep('s2', 6), legacyStep('s3', 10)];
    timelineState.loop = false;
    timelineState.transition.enabled = transition;
    timelineState.transition.seconds = transition ? 1 : 0;
    const player = createTimelinePlayer({
      engine: ctx.engine, state: ctx.state, timelineState,
      renderTimeline: noop, setTimelineStatus: noop,
      applyAudioState: ctx.audio.applyAudioState,
      applyAudioSnapshot: ctx.audio.applyAudioSnapshot,
      interpolateAudioState: ctx.audio.interpolateAudioState,
      showToast: noop, ensurePlaybackStarted: noop,
    });
    return player;
  }

  // 1. Un preset builtin no fabrica ceros para claves que no define
  {
    const { preset } = build();
    const snap = preset.snapshotForPreset('builtin-alpha');
    check(snap && !('mix' in snap) && !('carrier' in snap), 'snapshot builtin no trae mix ni carrier', JSON.stringify(snap));
    check(snap && snap.brainwave === 10, 'snapshot builtin conserva su brainwave', `bw=${snap && snap.brainwave}`);
  }

  // 2. Aplicar un preset no mueve el volumen y conserva una portadora válida
  {
    const { state, audio, engine } = build({ mix: 80, carrier: 200 });
    audio.applyAudioSnapshot({ brainwave: 10, carrier: 0, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 0 }, 'legado');
    check(state.mix === 80, 'preset con mix 0 guardado no baja el volumen', `mix=${state.mix}`);
    check(state.carrier === 200, 'preset con carrier 0 guardado conserva la portadora', `carrier=${state.carrier}`);
    check(!engine.carriers.includes(0), 'ningún oscilador recibe 0 Hz', JSON.stringify(engine.carriers));
    audio.applyAudioSnapshot({ brainwave: 10, carrier: 300, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 30 }, 'custom');
    check(state.mix === 80 && state.carrier === 300, 'preset válido aplica carrier pero no mix', `mix=${state.mix} carrier=${state.carrier}`);
  }

  // 3. applyAudioState sin opciones sigue pudiendo bajar el mix (lo necesita el stop suave)
  {
    const { state, audio } = build({ mix: 80 });
    audio.applyAudioState({ ...audioSnapshot(state), mix: 0 });
    check(state.mix === 0, 'applyAudioState directo conserva el fade de mix del stop suave', `mix=${state.mix}`);
  }

  // 4. El timeline con datos legados (con transición) deja mix y carrier intactos
  {
    const ctx = build({ mix: 80, carrier: 200 });
    const player = makePlayer(ctx, { transition: true });
    player.play();
    const seen = { mix: new Set(), carrier: new Set(), bw: new Set() };
    for (let t = 0; t <= 6.5; t += 0.25) {
      ctx.engine.ctx.currentTime = t;
      player.catchUp();
      player.applyTransitionProgress();
      seen.mix.add(Math.round(ctx.state.mix * 1000) / 1000);
      seen.carrier.add(ctx.state.carrier);
      seen.bw.add(Math.round(ctx.state.brainwave * 10) / 10);
    }
    player.stop();
    check([...seen.mix].join(',') === '80', 'timeline con transición: el mix se mantiene en 80', [...seen.mix].join(','));
    check([...seen.carrier].join(',') === '200', 'timeline con transición: la portadora se mantiene en 200', [...seen.carrier].join(','));
    check(seen.bw.has(2) && seen.bw.has(6) && seen.bw.has(10), 'timeline con transición: sigue aplicando cada brainwave', [...seen.bw].join(','));
    check(!ctx.engine.carriers.includes(0), 'timeline con transición: ningún oscilador recibe 0 Hz');
  }

  // 5. El timeline sin transición (corte directo) tampoco toca mix ni carrier
  {
    const ctx = build({ mix: 65, carrier: 250 });
    const player = makePlayer(ctx, { transition: false });
    player.play();
    check(ctx.state.mix === 65 && ctx.state.carrier === 250 && ctx.state.brainwave === 2,
      'corte directo: mix y carrier intactos y brainwave del paso aplicado',
      `mix=${ctx.state.mix} carrier=${ctx.state.carrier} bw=${ctx.state.brainwave}`);
    player.stop();
  }

  // 6. Timeline guardado con el defecto, leído por la normalización de almacenamiento
  {
    const stored = { steps: [legacyStep('s1', 2)], loop: false, transition: { enabled: false, seconds: 0 } };
    const normalized = normalizeTimelineStorage(stored, (p) => `${p}-id`);
    const ctx = build({ mix: 80, carrier: 200 });
    ctx.audio.applyAudioSnapshot(normalized.steps[0].snapshot, 'guardado');
    check(ctx.state.mix === 80 && ctx.state.carrier === 200 && ctx.state.brainwave === 2,
      'timeline guardado con el defecto: se interpreta de forma segura', `mix=${ctx.state.mix} carrier=${ctx.state.carrier}`);
  }

  // 7. Stop suave: restaura el volumen del usuario, con rAF normal y con rAF detenido (pestaña oculta)
  async function gentleStopScenario(label, rafMode) {
    const ctx = build({ mix: 80 });
    ctx.state.stopBehavior = { targetBand: 'alpha', fadeSeconds: 0.3 };
    const realRaf = globalThis.requestAnimationFrame;
    const realCaf = globalThis.cancelAnimationFrame;
    globalThis.document = { getElementById: () => null };
    globalThis.requestAnimationFrame = rafMode === 'hidden'
      ? () => 0
      : (fn) => setTimeout(() => fn(performance.now()), 16);
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
    const playback = createPlaybackController({
      state: ctx.state, engine: ctx.engine, getTimelinePlayer: () => null,
      clampTransitionSeconds, audioSnapshot,
      stopTargetSnapshot: ctx.preset.stopTargetSnapshot, stopTargetLabel: ctx.preset.stopTargetLabel,
      applyAudioState: ctx.audio.applyAudioState, interpolateAudioState: ctx.audio.interpolateAudioState,
      syncUIFromState: noop, updateBrain: noop, updateSpatialReadout: noop,
      setTimelineStatus: noop, showToast: noop,
    });
    playback.requestGentleStop();
    await sleep(1200);
    check(ctx.state.playing === false, `stop suave (${label}): termina y detiene el audio`, `playing=${ctx.state.playing}`);
    check(ctx.state.mix === 80, `stop suave (${label}): restaura el volumen del usuario`, `mix=${ctx.state.mix}`);
    globalThis.requestAnimationFrame = realRaf;
    globalThis.cancelAnimationFrame = realCaf;
    delete globalThis.document;
  }
  await gentleStopScenario('rAF normal', 'normal');
  await gentleStopScenario('pestaña oculta', 'hidden');

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
