import {
  AVAILABLE_EMOTES,
  AUDIO_KEYS,
  BUILTIN_PRESETS,
  STOP_BEHAVIOR_DEFAULTS,
  STROBE_DEFAULTS,
  createTimelineState,
} from './cortex-config.js';
import { bandFromFreq, clampStrobeHz } from './core-math.js';

export function audioSnapshot(source = {}) {
  return Object.fromEntries(AUDIO_KEYS.map((key) => [key, Number(source[key]) || 0]));
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

export function normalizeStrobePresentation(value) {
  return value === 'mini' ? 'mini' : 'integrated';
}

export function normalizeStrobeState(value = {}) {
  return {
    mode: normalizeStrobeMode(value.mode),
    customHz: clampStrobeHz(value.customHz ?? STROBE_DEFAULTS.customHz),
    presentation: normalizeStrobePresentation(value.presentation),
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
