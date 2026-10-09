import fs from 'node:fs';
import path from 'node:path';
import {
  STROBE_RAMP_MAX_MS,
  STROBE_RAMP_RATIO,
  bandFromFreq,
  binauralFrequencies,
  mixPercentToGain,
  strobeFrequencyFromState,
  strobeIntensityWindow,
  strobePhaseWindow,
  strobeRampRatio,
} from '../../src/lib/core-math.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '..', '..');
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'math-reference', 'fixtures.json'), 'utf8'));
const tolerances = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'math-reference', 'tolerances.json'), 'utf8'));

function near(a, b, tolerance) {
  return Math.abs(Number(a) - Number(b)) <= tolerance;
}

function buildJsReference() {
  return {
    meta: {
      strobeDuty: 0.5,
      strobeRampRatio: STROBE_RAMP_RATIO,
      strobeRampMaxMs: STROBE_RAMP_MAX_MS,
    },
    bands: fixtures.bandCases.map((hz) => ({ hz, band: bandFromFreq(hz) })),
    binaural: fixtures.binauralCases.map((entry) => ({
      ...entry,
      ...binauralFrequencies(entry.carrier, entry.brainwave),
    })),
    mix: fixtures.mixCases.map((mix) => ({ mix, gain: mixPercentToGain(mix) })),
    strobe: fixtures.strobeCases.map((entry) => {
      const hz = strobeFrequencyFromState({ mode: entry.mode, customHz: entry.customHz }, { brainwave: entry.brainwave });
      return {
        mode: entry.mode,
        brainwave: entry.brainwave,
        customHz: entry.customHz,
        hz,
        cycleMs: 1000 / hz,
        on: entry.timestampsMs.map((timestampMs) => strobePhaseWindow(hz, timestampMs).on ? 1 : 0),
        phase: entry.timestampsMs.map((timestampMs) => Number(strobePhaseWindow(hz, timestampMs).progress.toFixed(8))),
      };
    }),
    strobeEnvelope: fixtures.strobeEnvelopeCases.map((entry) => {
      const hz = strobeFrequencyFromState({ mode: entry.mode, customHz: entry.customHz }, { brainwave: entry.brainwave });
      return {
        mode: entry.mode,
        brainwave: entry.brainwave,
        customHz: entry.customHz,
        hz,
        cycleMs: 1000 / hz,
        ramp: Number(strobeRampRatio(hz).toFixed(12)),
        intensity: entry.timestampsMs.map(
          (timestampMs) => Number(strobeIntensityWindow(hz, timestampMs).intensity.toFixed(12)),
        ),
      };
    }),
  };
}

function compareAgainstPython(jsReference, pythonReference) {
  const failures = [];

  if (pythonReference.meta) {
    if (pythonReference.meta.strobeDuty !== jsReference.meta.strobeDuty
      || !near(pythonReference.meta.strobeRampRatio, jsReference.meta.strobeRampRatio, tolerances.rampRatio)
      || !near(pythonReference.meta.strobeRampMaxMs, jsReference.meta.strobeRampMaxMs, tolerances.rampRatio)) {
      failures.push({ metric: 'meta', expected: pythonReference.meta, actual: jsReference.meta });
    }
  }

  jsReference.bands.forEach((entry, index) => {
    const ref = pythonReference.bands[index];
    if (!ref || entry.band !== ref.band) {
      failures.push({ metric: 'band', index, expected: ref, actual: entry });
    }
  });

  jsReference.binaural.forEach((entry, index) => {
    const ref = pythonReference.binaural[index];
    if (!ref || !near(entry.left, ref.left, tolerances.frequencyHz) || !near(entry.right, ref.right, tolerances.frequencyHz)) {
      failures.push({ metric: 'binaural', index, expected: ref, actual: entry });
    }
  });

  jsReference.mix.forEach((entry, index) => {
    const ref = pythonReference.mix[index];
    if (!ref || !near(entry.gain, ref.gain, tolerances.mixGain)) {
      failures.push({ metric: 'mix', index, expected: ref, actual: entry });
    }
  });

  jsReference.strobe.forEach((entry, index) => {
    const ref = pythonReference.strobe[index];
    if (!ref) {
      failures.push({ metric: 'strobe', index, expected: ref, actual: entry });
      return;
    }
    if (!near(entry.hz, ref.hz, tolerances.frequencyHz) || !near(entry.cycleMs, ref.cycleMs, tolerances.cycleMs)) {
      failures.push({ metric: 'strobe-meta', index, expected: ref, actual: entry });
      return;
    }
    entry.phase.forEach((phase, phaseIndex) => {
      if (!near(phase, ref.phase[phaseIndex], tolerances.phase)) {
        failures.push({ metric: 'strobe-phase', index, phaseIndex, expected: ref.phase[phaseIndex], actual: phase });
      }
    });
    entry.on.forEach((value, phaseIndex) => {
      if (value !== ref.on[phaseIndex]) {
        failures.push({ metric: 'strobe-on', index, phaseIndex, expected: ref.on[phaseIndex], actual: value });
      }
    });
  });

  (jsReference.strobeEnvelope || []).forEach((entry, index) => {
    const ref = pythonReference.strobeEnvelope?.[index];
    if (!ref) {
      failures.push({ metric: 'strobe-envelope', index, expected: ref, actual: entry });
      return;
    }
    if (!near(entry.hz, ref.hz, tolerances.frequencyHz)
      || !near(entry.cycleMs, ref.cycleMs, tolerances.cycleMs)
      || !near(entry.ramp, ref.ramp, tolerances.rampRatio)) {
      failures.push({ metric: 'strobe-envelope-meta', index, expected: ref, actual: entry });
      return;
    }
    entry.intensity.forEach((value, sampleIndex) => {
      if (!near(value, ref.intensity[sampleIndex], tolerances.intensity)) {
        failures.push({
          metric: 'strobe-envelope-intensity',
          index,
          sampleIndex,
          expected: ref.intensity[sampleIndex],
          actual: value,
        });
      }
    });
  });

  return failures;
}

const jsReference = buildJsReference();
const pythonFile = process.argv[2] || process.env.PYTHON_REFERENCE_JSON || '';

if (!pythonFile) {
  console.log(JSON.stringify({ mode: 'js-reference-only', tolerances, reference: jsReference }, null, 2));
  process.exit(0);
}

const pythonReference = JSON.parse(fs.readFileSync(path.resolve(root, pythonFile), 'utf8'));
const failures = compareAgainstPython(jsReference, pythonReference);
console.log(JSON.stringify({ mode: 'comparison', tolerances, failures, jsReference }, null, 2));
process.exit(failures.length ? 1 : 0);
