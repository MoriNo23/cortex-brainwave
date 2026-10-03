import { audioSnapshot, clampTransitionSeconds } from './cortex-persistence.js';

/* Intervalo del tick de catch-up. Corto para que el retraso sea imperceptible
   con la pestaña oculta y barato de mantener en segundo plano. */
const TIMELINE_TICK_MS = 60;
/* Tope de iteraciones del fast-forward: con pasos de 1 s cubre más de dos horas
   de ocultamiento en un solo tick. Si se superara, el tick siguiente lo remata. */
const TIMELINE_CATCHUP_GUARD = 8000;

function formatDuration(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

export function createTimelinePlayer({
  engine,
  state,
  timelineState,
  renderTimeline,
  setTimelineStatus,
  applyAudioState,
  applyAudioSnapshot,
  interpolateAudioState,
  showToast,
  ensurePlaybackStarted,
}) {
  return new TimelinePlayer({
    engine,
    state,
    timelineState,
    renderTimeline,
    setTimelineStatus,
    applyAudioState,
    applyAudioSnapshot,
    interpolateAudioState,
    showToast,
    ensurePlaybackStarted,
  });
}

class TimelinePlayer {
  constructor({
    engine,
    state,
    timelineState,
    renderTimeline,
    setTimelineStatus,
    applyAudioState,
    applyAudioSnapshot,
    interpolateAudioState,
    showToast,
    ensurePlaybackStarted,
  }) {
    this.engine = engine;
    this.state = state;
    this.timelineState = timelineState;
    this.renderTimeline = renderTimeline;
    this.setTimelineStatus = setTimelineStatus;
    this.applyAudioState = applyAudioState;
    this.applyAudioSnapshot = applyAudioSnapshot;
    this.interpolateAudioState = interpolateAudioState;
    this.showToast = showToast;
    this.ensurePlaybackStarted = ensurePlaybackStarted;

    this.index = 0;
    this.stepStartedAt = 0;   // reloj de audio: inicio del paso actual
    this.boundaryAt = 0;      // reloj de audio: instante en que termina el paso
    this.pausedRemainingMs = 0;
    this.pausedTransitionMs = 0;  // rampa que quedaba al pausar
    this.frozenRemainingMs = 0;  // último restante conocido, si el reloj se detiene
    this.stalled = false;        // el reloj de audio no está corriendo
    this.running = false;
    this.paused = false;
    this.sourceState = null;   // estado de audio al empezar la rampa
    this.targetState = null;   // preset al que converge la rampa
    this.transitionMs = 0;     // duración de la rampa del segmento en curso
    this.transitionStartedAt = 0; // reloj de audio: inicio del segmento de rampa
    this.transitionDone = true;  // true = sin rampa pendiente
    this.tick = null;
    this.timer = null;
    this.onStep = null;       // punto de extensión para el futuro dock
  }

  /* El reloj de audio es la fuente de verdad. Los temporizadores solo disparan
     la comprobación: la decisión de avanzar la toma el reloj. */
  clockRunning() {
    return Boolean(this.engine.ctx) && this.engine.ctx.state === 'running';
  }

  clockNow() {
    return this.clockRunning() ? this.engine.ctx.currentTime : 0;
  }

  /* Tiempo restante real del paso en curso, derivado del reloj de audio.
     Es un valor vivo: la UI lo lee y nunca muestra la duración completa como
     si fuera el restante. */
  get remainingMs() {
    if (this.paused) return this.pausedRemainingMs;
    if (!this.running) return 0;
    if (!this.clockRunning()) return this.frozenRemainingMs;
    return Math.max(0, (this.boundaryAt - this.clockNow()) * 1000);
  }

  /* Refresca el contador visible. El texto solo se reescribe cuando cambia el
     segundo mostrado, así que el costo por tick es despreciable. */
  refreshStatus() {
    if (!this.running) return;
    if (this.stalled) return;   // el aviso de audio suspendido tiene prioridad
    const step = this.timelineState.steps[this.index];
    if (!step) return;
    this.frozenRemainingMs = this.remainingMs;
    const suffix = this.transitionInProgress() ? ' · transición' : '';
    this.setTimelineStatus(`Paso ${this.index + 1}/${this.timelineState.steps.length}: ${step.emoji} ${step.name} · ${formatDuration(this.remainingMs)}${suffix}`);
  }

  transitionInProgress() {
    return this.running && !this.transitionDone;
  }

  /* Tiempo de rampa consumido del segmento en curso. */
  transitionElapsedMs() {
    if (this.transitionMs === 0) return 0;
    return Math.max(0, (this.clockNow() - this.transitionStartedAt) * 1000);
  }

  /* Aplica un punto de la rampa: interpola de source a target con el progreso
     del reloj de audio. Al terminar, fija exactamente el preset del paso. */
  applyTransitionProgress() {
    if (!this.running || this.transitionDone) return;
    const elapsedMs = this.transitionElapsedMs();
    if (elapsedMs >= this.transitionMs) {
      this.transitionDone = true;
      this.applyAudioState(this.targetState);
      return;
    }
    this.applyAudioState(this.interpolateAudioState(this.sourceState, this.targetState, elapsedMs / this.transitionMs));
  }

  clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  clearTick() {
    if (this.tick !== null) clearInterval(this.tick);
    this.tick = null;
  }

  stopTimers() {
    this.clearTimer();
    this.clearTick();
  }

  /* Reancla el paso actual al reloj de audio. `startedAt` permite mantener el
     inicio ya consumido (reanudación, cambio de duración) en vez de reiniciar
     el paso desde cero. `transitionOverrideMs` fija la rampa del segmento
     (lo que quedaba al reanudar o reprogramar) en vez del valor configurado. */
  startStep(remainingOverride, startedAt, transitionOverrideMs) {
    this.stopTimers();
    const step = this.timelineState.steps[this.index];
    if (!step) return this.finish();

    const durationMs = remainingOverride != null
      ? Math.max(0, remainingOverride)
      : step.durationSeconds * 1000;

    // Transición: capturar el estado vivo ANTES de tocar nada, y el preset al
    // que la rampa converge. Con transición desactivada o en 0 s, corte directo.
    this.sourceState = audioSnapshot(this.state);
    this.targetState = audioSnapshot(step.snapshot);
    this.transitionMs = transitionOverrideMs != null
      ? Math.max(0, Math.min(transitionOverrideMs, durationMs))
      : (this.timelineState.transition.enabled
          ? Math.min(durationMs, clampTransitionSeconds(this.timelineState.transition.seconds) * 1000)
          : 0);
    this.transitionDone = this.transitionMs === 0;
    this.transitionStartedAt = this.clockNow();

    if (this.transitionMs === 0) {
      this.applyAudioSnapshot(step.snapshot, `${step.emoji} ${step.name}`);
    } else {
      this.showToast(`${step.emoji} ${step.name}`);
    }

    this.running = true;
    this.paused = false;
    this.pausedRemainingMs = 0;
    this.pausedTransitionMs = 0;
    this.stalled = false;
    this.stepStartedAt = startedAt != null ? startedAt : this.clockNow();
    this.boundaryAt = this.stepStartedAt + durationMs / 1000;
    this.frozenRemainingMs = durationMs;

    // Tick periódico: sobrevive a la estrangulación porque recalcula desde el
    // reloj de audio, no desde un deadline acumulado. Además avanza la rampa y
    // refresca el contador visible para que la UI muestre la posición real.
    this.tick = setInterval(() => {
      this.catchUp();
      this.applyTransitionProgress();
      this.refreshStatus();
    }, TIMELINE_TICK_MS);
    // Respaldo con timeout para cuando setInterval no vuelve a disparar.
    this.armTimeout();

    if (this.onStep) {
      this.onStep(this.index, step, durationMs, {
        source: this.sourceState,
        target: this.targetState,
        transitionMs: this.transitionMs,
      });
    }
    this.refreshStatus();
    this.renderTimeline();
  }

  armTimeout() {
    this.clearTimer();
    const delayMs = Math.max(16, (this.boundaryAt - this.clockNow()) * 1000);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.catchUp();
    }, delayMs);
  }

  /* Idempotente: se puede llamar desde el tick, desde el timeout de respaldo
     y al volver a la pestaña. */
  catchUp() {
    if (!this.running) return;
    if (!this.clockRunning()) {
      this.noteClockStall();
      return;
    }
    this.stalled = false;
    if (this.clockNow() < this.boundaryAt) return;
    this.advance();
  }

  /* Sin un AudioContext corriendo no hay reloj: `currentTime` no avanza y la
     secuencia quedaría congelada sin explicación (así se ve en Firefox, que
     exige un gesto del usuario para arrancar el audio). Se intenta reanudar y,
     si no se puede, se dice qué hacer en vez de aparentar que está sonando. */
  noteClockStall() {
    if (this.stalled) return;
    this.stalled = true;
    if (this.engine.ctx && this.engine.ctx.state === 'suspended') {
      try { this.engine.ctx.resume(); } catch (error) { /* requiere gesto del usuario */ }
    }
    if (this.clockRunning()) {
      this.stalled = false;
      return;
    }
    this.setTimelineStatus('Audio en pausa: el navegador no habilitó el contexto de audio. Hacé click en Iniciar para que la línea de tiempo avance.');
  }

  /* Avanza al paso siguiente usando el límite anterior como nuevo inicio: el
     retraso de un tick no se propaga al resto de la secuencia. Si mientras no
     se renderizaba vencieron varios límites, se salta directo al paso que
     corresponde a "ahora" sin aplicar los intermedios. */
  advance() {
    let index = this.index;
    let start = this.stepStartedAt;
    let end = this.boundaryAt;
    let guard = 0;
    while (guard++ < TIMELINE_CATCHUP_GUARD) {
      if (index < this.timelineState.steps.length - 1) index += 1;
      else if (this.timelineState.loop && this.timelineState.steps.length) index = 0;
      else {
        this.index = index;
        return this.finish();
      }
      const step = this.timelineState.steps[index];
      start = end;
      end = start + (step ? step.durationSeconds * 1000 : 0) / 1000;
      if (end > this.clockNow()) break;
    }
    this.index = index;
    this.startStep(undefined, start);
  }

  finish() {
    this.stopTimers();
    this.running = false;
    this.paused = false;
    this.pausedRemainingMs = 0;
    this.frozenRemainingMs = 0;
    this.stalled = false;
    this.stepStartedAt = 0;
    this.boundaryAt = 0;
    this.setTimelineStatus('Timeline completado.');
    this.renderTimeline();
  }

  /* Al volver a la pestaña, el reloj de audio puede haber avanzado varios
     límites: se sincroniza y la UI refleja la posición real. */
  syncOnVisible() {
    if (!this.running) return;
    this.catchUp();
    if (!this.running) return;
    this.refreshStatus();
    this.armTimeout();
    this.renderTimeline();
  }

  play() {
    if (!this.timelineState.steps.length) {
      this.setTimelineStatus('Agrega al menos un preset para reproducir.');
      return false;
    }
    if (!this.state.playing) this.ensurePlaybackStarted();
    if (this.paused) {
      // Reanuda el mismo paso por el tiempo exacto que quedaba, y la rampa por
      // lo que le faltaba: converge al preset sin recomenzar desde el origen.
      this.startStep(this.pausedRemainingMs, undefined, this.pausedTransitionMs);
    } else {
      this.index = 0;
      this.startStep();
    }
    return true;
  }

  pause() {
    if (!this.running) return;
    // El restante sale del reloj de audio, no de restar tiempo de pared.
    this.pausedRemainingMs = Math.max(0, (this.boundaryAt - this.clockNow()) * 1000);
    // Lo que le falta a la rampa: 0 si ya terminó o si no había.
    this.pausedTransitionMs = this.transitionDone
      ? 0
      : Math.min(
          this.pausedRemainingMs,
          Math.max(0, this.transitionMs - this.transitionElapsedMs())
        );
    this.stopTimers();
    this.running = false;
    this.paused = true;
    this.setTimelineStatus(`Pausado en paso ${this.index + 1} · ${formatDuration(this.pausedRemainingMs)} restantes`);
    this.renderTimeline();
  }

  stop() {
    this.stopTimers();
    this.running = false;
    this.paused = false;
    this.pausedRemainingMs = 0;
    this.pausedTransitionMs = 0;
    this.frozenRemainingMs = 0;
    this.stalled = false;
    this.index = 0;
    this.stepStartedAt = 0;
    this.boundaryAt = 0;
    this.transitionMs = 0;
    this.transitionDone = true;
    this.sourceState = null;
    this.targetState = null;
    this.setTimelineStatus(this.timelineState.steps.length ? 'Timeline detenido.' : 'Agrega presets para construir una secuencia.');
    this.renderTimeline();
  }

  /* Recalcula el paso en curso desde el reloj de audio tras editar su duración.
     El tiempo ya consumido no se pierde y el restante ya no tiene el piso
     artificial de 1 s: si la nueva duración ya venció, el paso avanza. */
  reschedule() {
    if (!this.running) return;
    const step = this.timelineState.steps[this.index];
    if (!step) return this.stop();
    const elapsed = Math.max(0, (this.clockNow() - this.stepStartedAt) * 1000);
    const remainingTransition = this.transitionDone
      ? 0
      : Math.max(0, this.transitionMs - this.transitionElapsedMs());
    this.startStep(Math.max(0, step.durationSeconds * 1000 - elapsed), this.stepStartedAt, remainingTransition);
  }

  /* Edición en vivo del interruptor o de la duración de transición: la rampa
     se recalcula sin reiniciar el paso. El progreso actual se conserva: el
     inicio del segmento se ancla para que el punto interpolado de ahora siga
     siendo el mismo y la rampa se estire o encoja hacia adelante. */
  refreshTransition() {
    if (!this.running && !this.paused) return;
    const configMs = this.timelineState.transition.enabled
      ? clampTransitionSeconds(this.timelineState.transition.seconds) * 1000
      : 0;

    if (configMs === 0) {
      // Desactivada: aplicar el destino directo y cerrar la rampa.
      if (!this.transitionDone) this.applyAudioState(this.targetState);
      this.transitionMs = 0;
      this.transitionDone = true;
      this.pausedTransitionMs = 0;
    } else {
      const remainingStep = this.paused ? this.pausedRemainingMs : this.remainingMs;
      const oldProgress = this.transitionDone
        ? 1
        : Math.min(1, this.transitionElapsedMs() / this.transitionMs);
      const nextMs = Math.max(0, Math.min(configMs, remainingStep));
      this.transitionMs = nextMs;
      this.transitionDone = nextMs === 0;
      // Anclar el inicio para continuar exactamente desde el punto actual.
      this.transitionStartedAt = this.clockNow() - oldProgress * (nextMs / 1000);
      if (this.paused) this.pausedTransitionMs = nextMs;
      if (this.transitionDone && this.targetState) this.applyAudioState(this.targetState);
    }
    if (this.paused) return;
    this.refreshStatus();
  }
}
