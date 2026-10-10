import {
  AVAILABLE_EMOTES,
  AUDIO_KEYS,
  BUILTIN_PRESETS,
  CARRIER_LIMITS,
  STOP_BEHAVIOR_DEFAULTS,
  STROBE_DEFAULTS,
  createTimelineState,
} from './cortex-config.js';
import { bandFromFreq, clampStrobeHz } from './core-math.js';

export function audioSnapshot(source = {}) {
  return Object.fromEntries(AUDIO_KEYS.map((key) => [key, Number(source[key]) || 0]));
}

/* Resuelve un snapshot de preset o de paso contra el estado vivo. Una clave
   ausente o no numérica se conserva del estado vivo (nunca se rellena con 0), y
   una portadora fuera del rango válido (p. ej. el 0 que guardaba el defecto
   anterior) tampoco se aplica. `mix` queda igual al vivo: el volumen es del
   usuario. */
export function resolveAudioSnapshot(snapshot, live = {}) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const resolved = {};
  AUDIO_KEYS.forEach((key) => {
    const value = Number(source[key]);
    resolved[key] = source[key] != null && Number.isFinite(value) ? value : (Number(live[key]) || 0);
  });
  if (!(resolved.carrier >= CARRIER_LIMITS.min && resolved.carrier <= CARRIER_LIMITS.max)) {
    const liveCarrier = Number(live.carrier);
    resolved.carrier = liveCarrier >= CARRIER_LIMITS.min && liveCarrier <= CARRIER_LIMITS.max ? liveCarrier : 200;
  }
  resolved.mix = Number(live.mix) || 0;
  return resolved;
}

export function normalizeDurationUnit(value) {
  return value === 'min' ? 'min' : 's';
}

export function durationLimits(kind) {
  return kind === 'transition' ? { min: 0, max: 60 } : { min: 1, max: 3600 };
}

export function clampDurationSeconds(value, kind = 'step') {
  const limits = durationLimits(kind);
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return Math.max(limits.min, Math.min(limits.max, seconds));
}

export function clampTransitionSeconds(value) {
  return clampDurationSeconds(value, 'transition') ?? 2;
}

export function normalizeStopBand(value) {
  return BUILTIN_PRESETS.some((preset) => preset.band === value) ? value : STOP_BEHAVIOR_DEFAULTS.targetBand;
}

export function normalizeStopBehavior(value = {}) {
  return {
    targetBand: normalizeStopBand(value.targetBand),
    fadeSeconds: clampTransitionSeconds(value.fadeSeconds ?? STOP_BEHAVIOR_DEFAULTS.fadeSeconds),
  };
}

export function normalizeStrobeMode(value) {
  return value === 'custom' ? 'custom' : 'sync';
}

export function normalizeStrobeState(value = {}) {
  return {
    mode: normalizeStrobeMode(value.mode),
    customHz: clampStrobeHz(value.customHz ?? STROBE_DEFAULTS.customHz),
    active: false,
  };
}

export function normalizeCustomPresets(raw) {
  const source = Array.isArray(raw) ? raw : [];
  return source
    .filter((preset) => preset && preset.id && preset.name && preset.state)
    .map((preset) => ({
      id: preset.id,
      name: String(preset.name).slice(0, 32),
      emoji: AVAILABLE_EMOTES.includes(preset.emoji) ? preset.emoji : AVAILABLE_EMOTES[0],
      state: audioSnapshot(preset.state),
      band: bandFromFreq(Number(preset.state.brainwave)),
    }));
}

export function normalizeTimelineStorage(raw, createId) {
  const normalized = createTimelineState();
  const source = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(source.steps) ? source.steps : [];
  normalized.steps = steps
    .filter((step) => step && step.snapshot && Number(step.durationSeconds) > 0)
    .map((step) => ({
      id: step.id || createId('step'),
      presetId: step.presetId || 'builtin-alpha',
      durationSeconds: Math.max(1, Math.min(3600, Number(step.durationSeconds) || 30)),
      snapshot: audioSnapshot(step.snapshot),
      name: step.name || 'Preset',
      emoji: step.emoji || '🎵',
      band: step.band || bandFromFreq(Number(step.snapshot.brainwave)),
    }));
  normalized.loop = Boolean(source.loop);
  const transition = source.transition || {};
  normalized.transition.enabled = transition.enabled !== false;
  normalized.transition.seconds = clampTransitionSeconds(transition.seconds ?? 2);
  const durationUnits = source.durationUnits || {};
  normalized.durationUnits.step = normalizeDurationUnit(durationUnits.step);
  normalized.durationUnits.transition = normalizeDurationUnit(durationUnits.transition);
  return normalized;
}

export function restoreUiPreferences(raw = {}) {
  return {
    dockExpanded: Boolean(raw.dockExpanded),
    stopBehavior: normalizeStopBehavior(raw.stopBehavior),
    strobe: normalizeStrobeState(raw.strobe),
  };
}

export function serializeUiPreferences(state) {
  return {
    dockExpanded: Boolean(state.dockExpanded),
    stopBehavior: normalizeStopBehavior(state.stopBehavior),
    strobe: normalizeStrobeState(state.strobe),
  };
}

export function serializeSettings(state) {
  const data = {
    ...state,
    stopBehavior: normalizeStopBehavior(state.stopBehavior),
    strobe: normalizeStrobeState(state.strobe),
  };
  delete data.playing;
  delete data.paused;
  delete data.band;
  return data;
}

export function restoreSettings(raw = {}) {
  return {
    ...raw,
    dockExpanded: Boolean(raw.dockExpanded),
    stopBehavior: normalizeStopBehavior(raw.stopBehavior),
    strobe: normalizeStrobeState(raw.strobe),
  };
}
