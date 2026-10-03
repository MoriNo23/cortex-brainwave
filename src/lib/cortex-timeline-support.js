import {
  clampDurationSeconds,
  durationLimits,
  normalizeDurationUnit,
  normalizeTimelineStorage,
} from './cortex-persistence.js';

export function createTimelineSupportController({ timelineState, createId, setText }) {
  function durationToSeconds(value, unit, kind = 'step') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return clampDurationSeconds(numeric * (normalizeDurationUnit(unit) === 'min' ? 60 : 1), kind);
  }

  function secondsToDuration(seconds, unit) {
    const canonical = Number(seconds);
    if (!Number.isFinite(canonical)) return '';
    const value = canonical / (normalizeDurationUnit(unit) === 'min' ? 60 : 1);
    return String(Number(value.toFixed(6)));
  }

  function durationInputConfig(kind, unit) {
    const normalized = normalizeDurationUnit(unit);
    const limits = durationLimits(kind);
    return {
      min: secondsToDuration(limits.min, normalized),
      max: secondsToDuration(limits.max, normalized),
      step: normalized === 'min' ? 'any' : (kind === 'transition' ? '0.1' : '1'),
    };
  }

  function durationHint(seconds, unit) {
    const normalized = normalizeDurationUnit(unit);
    const other = normalized === 'min' ? 's' : 'min';
    return `≈ ${secondsToDuration(seconds, other)} ${other}`;
  }

  function persistTimeline() {
    localStorage.setItem('cortex-timeline-v1', JSON.stringify(timelineState));
  }

  function loadTimelineData() {
    try {
      const raw = JSON.parse(localStorage.getItem('cortex-timeline-v1') || '{}');
      const normalized = normalizeTimelineStorage(raw, createId);
      Object.assign(timelineState, normalized);
    } catch (error) {
      Object.assign(timelineState, normalizeTimelineStorage({}, createId));
    }
  }

  function setTimelineStatus(text) {
    setText('timelineStatus', text);
  }

  return {
    durationHint,
    durationInputConfig,
    durationToSeconds,
    loadTimelineData,
    normalizeDurationUnit,
    persistTimeline,
    secondsToDuration,
    setTimelineStatus,
  };
}
