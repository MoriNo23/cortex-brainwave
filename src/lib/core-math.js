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
