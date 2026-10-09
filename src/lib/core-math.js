export function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function bandFromFreq(hz) {
  const value = Number(hz);
  if (value < 4) return 'delta';
  if (value < 8) return 'theta';
  if (value < 13) return 'alpha';
  if (value < 30) return 'beta';
  return 'gamma';
}

export function binauralFrequencies(carrier, brainwave) {
  const base = Number(carrier) || 0;
  const delta = Number(brainwave) || 0;
  return { left: base, right: base + delta };
}

export function mixPercentToGain(mixPercent) {
  return clamp(mixPercent, 0, 100) / 100 * 0.5;
}

export function interpolateScalar(from, to, progress) {
  const t = clamp(progress, 0, 1);
  return (Number(from) || 0) + ((Number(to) || 0) - (Number(from) || 0)) * t;
}

export function clampStrobeHz(hz) {
  return clamp(hz, 0.5, 40);
}

export function strobeFrequencyFromState(strobeState, audioState) {
  if (strobeState.mode === 'sync') return clampStrobeHz(audioState.brainwave);
  return clampStrobeHz(strobeState.customHz);
}

export function strobePhaseWindow(hz, timestampMs) {
  const safeHz = clampStrobeHz(hz);
  const cycleMs = 1000 / safeHz;
  const phase = ((timestampMs % cycleMs) + cycleMs) % cycleMs;
  return {
    cycleMs,
    phase,
    on: phase < cycleMs * 0.5,
    progress: cycleMs === 0 ? 0 : phase / cycleMs,
  };
}

/* ── ENVOLVENTE SUAVE DEL FLASH ──
   `strobePhaseWindow` sigue siendo el contrato on/off (duty 0.5) que contrasta la
   referencia de Python; aquí se deriva la intensidad *pintada* a partir de esa
   misma fase. Un escalón duro al 100 % de contraste produce parpadeo sucio por
   aliasing cuando la frecuencia del flash y la del monitor no son múltiplos
   (10 Hz sobre 60 Hz, 18 Hz sobre 144 Hz…). Un ataque y una caída cortos
   eliminan ese batido sin mover la frecuencia ni el duty.

   La rampa es proporcional al ciclo (12 %) con techo absoluto en ms: a 40 Hz
   son ~3 ms y a 0.5 Hz no se estira más allá de 16 ms, así el flash lento
   sigue leyendo como flash. */
export const STROBE_RAMP_RATIO = 0.12;
export const STROBE_RAMP_MAX_MS = 16;

export function strobeRampRatio(hz) {
  const { cycleMs } = strobePhaseWindow(hz, 0);
  if (!(cycleMs > 0)) return 0;
  return Math.min(STROBE_RAMP_RATIO, STROBE_RAMP_MAX_MS / cycleMs);
}

/* Intensidad continua en [0, 1] para una fase dada. Se exporta por separado
   porque el worker de la ventana flotante reutiliza esta misma función. */
export function strobeIntensityAt(progress, rampRatio) {
  const t = clamp(progress, 0, 1);
  const ramp = clamp(rampRatio, 0, 0.25);
  if (ramp === 0) return t < 0.5 ? 1 : 0;
  if (t < ramp) return t / ramp;
  if (t < 0.5) return 1;
  if (t < 0.5 + ramp) return 1 - (t - 0.5) / ramp;
  return 0;
}

export function strobeIntensityWindow(hz, timestampMs) {
  const window = strobePhaseWindow(hz, timestampMs);
  const ramp = strobeRampRatio(hz);
  return {
    ...window,
    ramp,
    intensity: strobeIntensityAt(window.progress, ramp),
  };
}
