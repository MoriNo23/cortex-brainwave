/* Lógica del timeline: programación de pasos, transiciones e interpolación.
   Spec: openspec/specs/timeline-scheduling + timeline-transitions (modelo unitario).
   Node puro: sin navegador y sin npm install. Importa el fuente real de
   src/lib (cortex-timeline-player.js) con un reloj simulado, igual que
   tests/mix-integrity.cjs. La integridad del mix/carrier frente al timeline
   NO se duplica aquí: la cubre tests/mix-integrity.cjs. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const noop = () => {};

/* Reloj simulado: solo lo que el player y el controller de audio consultan
   del motor (como makeEngine de tests/mix-integrity.cjs). */
function makeEngine(clock) {
  const carriers = [];
  return {
    ctx: { state: 'running', get currentTime() { return clock.t; } },
    carriers,
    updateBrainwave: noop,
    updateCarrier(freq) { carriers.push(freq); },
    updateModLevels: noop,
  };
}

function makeSteps() {
  const snap = (brainwave, carrier) => ({
    brainwave, carrier, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80,
  });
  return [
    { id: 's1', presetId: 'builtin-delta', durationSeconds: 1, snapshot: snap(2, 200), name: 'Delta', emoji: 'D', band: 'delta' },
    { id: 's2', presetId: 'builtin-theta', durationSeconds: 1, snapshot: snap(6, 210), name: 'Theta', emoji: 'T', band: 'theta' },
    { id: 's3', presetId: 'builtin-alpha', durationSeconds: 1, snapshot: snap(10, 220), name: 'Alpha', emoji: 'A', band: 'alpha' },
  ];
}

function makeTimelineState() {
  return {
    steps: makeSteps(),
    loop: false,
    transition: { enabled: false, seconds: 0 },
    durationUnits: { step: 's', transition: 's' },
  };
}

(async () => {
  const config = await import('../src/lib/cortex-config.js');
  const persistence = await import('../src/lib/cortex-persistence.js');
  const { createAudioStateController } = await import('../src/lib/cortex-audio-state.js');
  const { createTimelinePlayer } = await import('../src/lib/cortex-timeline-player.js');
  const { audioSnapshot } = persistence;

  function build({ transition = false, seconds = 0, loop = false, stepSeconds = 1 } = {}) {
    const clock = { t: 0 };
    const engine = makeEngine(clock);
    const state = { brainwave: 10, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80, playing: true };
    const timelineState = makeTimelineState();
    timelineState.steps.forEach((s) => { s.durationSeconds = stepSeconds; });
    timelineState.loop = loop;
    timelineState.transition.enabled = transition;
    timelineState.transition.seconds = seconds;
    const audio = createAudioStateController({
      state, engine, audioSnapshot, markUiDirty: noop, updateBrain: noop, showToast: noop,
    });
    const status = [];
    const player = createTimelinePlayer({
      engine, state, timelineState,
      renderTimeline: noop,
      setTimelineStatus: (text) => status.push(text),
      applyAudioState: audio.applyAudioState,
      applyAudioSnapshot: audio.applyAudioSnapshot,
      interpolateAudioState: audio.interpolateAudioState,
      showToast: noop,
      ensurePlaybackStarted: noop,
    });
    return { clock, engine, state, timelineState, player, status };
  }

  // 1. Orden de pasos: la secuencia 2 → 6 → 10 se aplica en orden y solo una vez
  {
    const ctx = build();
    ctx.player.play();
    const bwSeen = [];
    for (let t = 0; t <= 3.2; t += 0.1) {
      ctx.clock.t = t;
      ctx.player.catchUp();
      ctx.player.applyTransitionProgress();
      bwSeen.push(Math.round(ctx.state.brainwave * 10) / 10);
    }
    ctx.player.stop();
    const firsts = [];
    for (const bw of bwSeen) if (firsts[firsts.length - 1] !== bw) firsts.push(bw);
    check(firsts.join(',') === '2,6,10', 'orden de pasos 2→6→10 sin repeticiones', firsts.join(','));
    check(ctx.player.running === false, 'termina tras el último paso (loop off)');
    check(ctx.status.some(s => s.includes('completado')), 'reporta completado', ctx.status[ctx.status.length - 1]);
  }

  // 1b. Detección de paso fuera de orden: si el fuente aplicara s3 antes que s2,
  // la secuencia vista no sería 2,6,10. (Guardia del port: pasar el test exige
  // el orden correcto; invertir los snapshots lo rompe.)
  {
    const ctx = build();
    ctx.player.play();
    ctx.clock.t = 1.05; ctx.player.catchUp(); ctx.player.applyTransitionProgress();
    check(ctx.state.brainwave === 6, 'paso 1 aplica 6 Hz (no 10: el orden manda)', `bw=${ctx.state.brainwave}`);
    ctx.player.stop();
  }

  // 2. Duración de transición: onStep expone la rampa; orilla del reloj
  {
    const ctx = build({ transition: true, seconds: 2, stepSeconds: 4 });
    const seen = [];
    ctx.player.onStep = (i, step, durationMs, info) => seen.push({ i, transitionMs: info.transitionMs, source: info.source.brainwave, target: info.target.brainwave });
    ctx.state.brainwave = 10; ctx.state.carrier = 200;
    ctx.player.play();
    check(seen.length === 1 && seen[0].transitionMs === 2000, 'onStep expone la rampa de 2 s', JSON.stringify(seen[0]));
    check(seen[0].source === 10 && seen[0].target === 2, 'origen = estado vivo, destino = preset', JSON.stringify(seen[0]));
    check(ctx.player.transitionMs === 2000, 'la rampa dura lo configurado dentro del paso', `transitionMs=${ctx.player.transitionMs}`);
    ctx.player.stop();
  }

  // 3. Interpolación entre estados: valores intermedios y convergencia exacta
  {
    const ctx = build({ transition: true, seconds: 1 });
    ctx.state.brainwave = 10; ctx.state.carrier = 200;
    ctx.player.play();
    const samples = [];
    for (let t = 0; t <= 1.05; t += 0.125) {
      ctx.clock.t = t;
      ctx.player.applyTransitionProgress();
      samples.push(ctx.state.brainwave);
    }
    ctx.player.stop();
    check(samples.some(v => v > 2.5 && v < 9.5), 'hay valores intermedios distintos de ambos extremos', samples.map(v => v.toFixed(2)).join(' → '));
    check(Math.abs(samples[samples.length - 1] - 2) < 1e-9, 'converge exactamente al preset (2 Hz)', samples[samples.length - 1].toFixed(4));
    // la interpolación es lineal en el progreso del reloj
    check(Math.abs(samples[4] - 6) < 0.01, 'punto medio ≈ 6 (lineal en el reloj de audio)', samples[4].toFixed(3));
  }

  // 3b. Interpolación pura de interpolateScalar/interpolateAudioState (fuente real)
  {
    const { interpolateScalar } = await import('../src/lib/core-math.js');
    check(interpolateScalar(0, 10, 0.5) === 5, 'interpolateScalar(0,10,0.5)=5', String(interpolateScalar(0, 10, 0.5)));
    check(interpolateScalar(2, 6, 0) === 2 && interpolateScalar(2, 6, 1) === 6, 'interpolateScalar clava extremos', `${interpolateScalar(2, 6, 0)} ${interpolateScalar(2, 6, 1)}`);
    const ctxA = build();
    const a = { brainwave: 2, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0 };
    const b = { brainwave: 6, carrier: 400, amod: 100, binaural: 50, stereo: 0, fmod: 0, noise: 0 };
    const mid = ctxA.player.interpolateAudioState(a, b, 0.5);
    check(mid.brainwave === 4 && mid.carrier === 300 && mid.amod === 50 && mid.binaural === 25, 'interpolateAudioState interpola cada clave', JSON.stringify(mid));
  }

  // 4. Pausa a mitad de rampa: congela el restante de paso y de rampa
  {
    const ctx = build({ transition: true, seconds: 2, stepSeconds: 4 });
    ctx.state.brainwave = 10;
    ctx.player.play();
    ctx.clock.t = 1.0;
    ctx.player.applyTransitionProgress();
    const midBw = ctx.state.brainwave;
    ctx.player.pause();
    const frozenRem = ctx.player.pausedRemainingMs;
    const frozenTrans = ctx.player.pausedTransitionMs;
    ctx.clock.t = 2.5; // el reloj avanza, pero está pausado
    const stillPaused = ctx.player.paused && Math.abs(ctx.player.remainingMs - frozenRem) < 2;
    ctx.player.play(); // reanudar
    ctx.clock.t = 2.55;
    ctx.player.applyTransitionProgress();
    ctx.player.stop();
    check(midBw > 2.5 && midBw < 9.5, 'la pausa ocurre en medio de la rampa', midBw.toFixed(2));
    check(Math.abs(frozenRem - 3000) < 2 && Math.abs(frozenTrans - 1000) < 2, 'congela restante de paso y de rampa', `rem=${frozenRem} trans=${frozenTrans}`);
    check(stillPaused, 'en pausa el reloj no consume el restante');
    check(Math.abs(ctx.state.brainwave - 2) > 0.5 && ctx.state.brainwave < midBw, 'reanudar retoma la rampa desde el punto actual', `bw=${ctx.state.brainwave}`);
  }

  // 5. Fast-forward: límites vencidos mientras no se renderizaba
  {
    const ctx = build();
    const appliedIdx = [];
    ctx.player.onStep = (i) => appliedIdx.push(i);
    ctx.player.play();
    ctx.clock.t = 0.05;
    ctx.player.catchUp();
    ctx.clock.t = 2.5; // dos límites vencidos de golpe
    ctx.player.catchUp();
    ctx.player.applyTransitionProgress();
    check(appliedIdx.length === 2 && !appliedIdx.includes(1), 'catch-up aplica un solo paso, sin los intermedios', JSON.stringify(appliedIdx));
    check(ctx.player.index === 2, 'el catch-up salta al paso resultante', `idx=${ctx.player.index}`);
    check(ctx.player.running, 'sigue reproduciendo tras el catch-up');
    ctx.player.stop();
  }

  // 6. Loop
  {
    const ctx = build({ loop: true });
    const appliedIdx = [];
    ctx.player.onStep = (i) => appliedIdx.push(i);
    ctx.player.play();
    ctx.clock.t = 3.05;
    ctx.player.catchUp();
    check(appliedIdx.filter(i => i === 0).length >= 2, 'el loop vuelve al paso 0', JSON.stringify(appliedIdx));
    check(ctx.player.running, 'sigue reproduciendo tras el ciclo');
    ctx.player.stop();
  }

  // 7. Timeline vacío
  {
    const ctx = build();
    ctx.timelineState.steps = [];
    const started = ctx.player.play();
    check(started === false && ctx.player.running === false, 'play() vacío no arranca');
    check(ctx.status.some(s => s.includes('Agrega al menos un preset')), 'explica por qué no arrancó', ctx.status[ctx.status.length - 1]);
  }

  // 8. Edición en vivo de duración: reschedule sin reiniciar el paso
  {
    const ctx = build();
    ctx.player.play();
    ctx.clock.t = 0.2;
    ctx.player.catchUp();
    const remBefore = ctx.player.remainingMs;
    ctx.timelineState.steps[0].durationSeconds = 6;
    ctx.player.reschedule();
    const remAfter = ctx.player.remainingMs;
    ctx.player.stop();
    check(ctx.player.index === 0 && remAfter > 5000, 'estirar reprograma desde el reloj, sin reiniciar', `idx=0 rem=${Math.round(remAfter)}`);
    check(Math.abs(remAfter - remBefore) > 4000, 'el restante refleja la nueva duración', `${Math.round(remBefore)} → ${Math.round(remAfter)}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
