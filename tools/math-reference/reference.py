from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import signal
import sympy as sp

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tools" / "math-reference" / "fixtures.json"


def js_number(value) -> float:
    """Semántica de Number(x) || 0 del JS: null/NaN/no-finito → 0."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0.0
    return f if np.isfinite(f) else 0.0


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, float(value)))


def band_from_freq(hz: float) -> str:
    if hz < 4:
        return "delta"
    if hz < 8:
        return "theta"
    if hz < 13:
        return "alpha"
    if hz < 30:
        return "beta"
    return "gamma"


def binaural_pair(carrier: float, brainwave: float) -> dict[str, float]:
    c = float(carrier)
    b = float(brainwave)
    return {"left": c, "right": c + b}


def mix_gain(mix_percent: float) -> float:
    value = js_number(mix_percent)
    return clamp(value, 0, 100) / 100.0 * 0.5


def strobe_hz(mode: str, brainwave: float, custom_hz: float) -> float:
    if mode == "sync":
        return clamp(brainwave, 0.5, 40)
    return clamp(custom_hz, 0.5, 40)


def strobe_samples(mode: str, brainwave: float, custom_hz: float, timestamps_ms: list[float]) -> dict:
    hz = strobe_hz(mode, brainwave, custom_hz)
    cycle_ms = 1000.0 / hz
    times_s = np.asarray(timestamps_ms, dtype=float) / 1000.0
    wave = signal.square(2 * np.pi * hz * times_s, duty=0.5)
    normalized = ((wave + 1.0) / 2.0).astype(int)
    phases = [float((ts % cycle_ms) / cycle_ms) for ts in timestamps_ms]
    return {
        "hz": hz,
        "cycleMs": cycle_ms,
        "on": normalized.tolist(),
        "phase": phases,
    }


STROBE_RAMP_RATIO = 0.12
STROBE_RAMP_MAX_MS = 16.0


def noise_filter_depth(carrier: float, fmod: float, sample_rate: float) -> float:
    """Profundidad de FM del filtro de ruido (cortex-audio-engine.js).

    Mismos clamps que el JS: el centro se ancla a [20, sampleRate*0.45] y la
    profundidad no puede acercarse a 0 Hz ni a Nyquist (margen 0.9).
    """
    c = float(carrier)
    f = float(fmod)
    rate = float(sample_rate)
    max_frequency = rate * 0.45
    center = clamp(c, 20.0, max_frequency) if np.isfinite(c) else 20.0
    raw_depth = center * (f / 150.0)
    safe_depth = max(0.0, min(center - 20.0, max_frequency - center) * 0.9)
    return float(min(raw_depth, safe_depth))


def interpolate_scalar(from_value: float, to_value: float, progress: float) -> float:
    """Interpolación escalar lineal con clamps (core-math.js interpolateScalar).

    La semántica JS de entradas inválidas se replica: Number(x) || 0 — null,
    NaN y no-numéricos colapsan a 0; el progreso se clava a [0, 1].
    """
    def numeric(value) -> float:
        try:
            f = float(value)
        except (TypeError, ValueError):
            return 0.0
        return f if np.isfinite(f) else 0.0

    a = numeric(from_value)
    b = numeric(to_value)
    t = clamp(numeric(progress), 0.0, 1.0)
    return float(a + (b - a) * t)


def strobe_ramp_ratio(hz: float) -> float:
    """Rampa de ataque/caída en fracción de ciclo: 12 % con techo de 16 ms."""
    cycle_ms = 1000.0 / clamp(hz, 0.5, 40)
    return min(STROBE_RAMP_RATIO, STROBE_RAMP_MAX_MS / cycle_ms)


def strobe_intensity(progress: float, ramp: float) -> float:
    """Intensidad pintada en [0, 1] a partir de la fase del flash."""
    t = clamp(progress, 0.0, 1.0)
    r = clamp(ramp, 0.0, 0.25)
    if r == 0.0:
        return 1.0 if t < 0.5 else 0.0
    if t < r:
        return t / r
    if t < 0.5:
        return 1.0
    if t < 0.5 + r:
        return 1.0 - (t - 0.5) / r
    return 0.0


def strobe_envelope(mode: str, brainwave: float, custom_hz: float, timestamps_ms: list[float]) -> dict:
    hz = strobe_hz(mode, brainwave, custom_hz)
    cycle_ms = 1000.0 / hz
    ramp = strobe_ramp_ratio(hz)
    phases = [float((ts % cycle_ms) / cycle_ms) for ts in timestamps_ms]
    return {
        "hz": hz,
        "cycleMs": cycle_ms,
        "ramp": ramp,
        "intensity": [strobe_intensity(phase, ramp) for phase in phases],
    }


def build_reference() -> dict:
    fixtures = json.loads(FIXTURES.read_text())
    carrier, brainwave = sp.symbols("carrier brainwave")
    binaural_expr = str(sp.simplify(carrier + brainwave))

    return {
        "meta": {
            "binauralFormula": binaural_expr,
            "mixFormula": "clamp(mix, 0, 100) / 100 * 0.5",
            "strobeDuty": 0.5,
            "strobeRampRatio": STROBE_RAMP_RATIO,
            "strobeRampMaxMs": STROBE_RAMP_MAX_MS,
        },
        "bands": [{"hz": hz, "band": band_from_freq(hz)} for hz in fixtures["bandCases"]],
        "binaural": [
            {
                **case,
                **binaural_pair(case["carrier"], case["brainwave"]),
            }
            for case in fixtures["binauralCases"]
        ],
        "mix": [{"mix": mix, "gain": mix_gain(mix)} for mix in fixtures["mixCases"]],
        "strobe": [
            {
                "mode": case["mode"],
                "brainwave": case["brainwave"],
                "customHz": case["customHz"],
                **strobe_samples(case["mode"], case["brainwave"], case["customHz"], case["timestampsMs"]),
            }
            for case in fixtures["strobeCases"]
        ],
        "strobeEnvelope": [
            {
                "mode": case["mode"],
                "brainwave": case["brainwave"],
                "customHz": case["customHz"],
                **strobe_envelope(case["mode"], case["brainwave"], case["customHz"], case["timestampsMs"]),
            }
            for case in fixtures["strobeEnvelopeCases"]
        ],
        "depth": [
            {"carrier": c, "fmod": f, "sampleRate": rate, "depth": noise_filter_depth(c, f, rate)}
            for (c, f, rate) in fixtures["depthCases"]
        ],
        "interp": [
            {**case, "value": interpolate_scalar(case["from"], case["to"], case["progress"])}
            for case in fixtures["interpCases"]
        ],
        "ramp": [
            {"hz": hz, "ramp": strobe_ramp_ratio(hz)}
            for hz in fixtures["rampCases"]
        ],
        "bandEdges": [
            {"hz": hz, "band": band_from_freq(hz)}
            for hz in fixtures["bandEdgeCases"]
        ],
        "mixEdges": [
            {"mix": mix, "gain": mix_gain(mix)}
            for mix in fixtures["mixEdgeCases"]
        ],
        "intensityAt": [
            {**case, "intensity": strobe_intensity(js_number(case["progress"]), js_number(case["ramp"]))}
            for case in fixtures["intensityAtCases"]
        ],
    }


if __name__ == "__main__":
    print(json.dumps(build_reference(), indent=2))
