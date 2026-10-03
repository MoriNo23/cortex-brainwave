from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import signal
import sympy as sp

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tools" / "math-reference" / "fixtures.json"


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
    return clamp(mix_percent, 0, 100) / 100.0 * 0.5


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


def build_reference() -> dict:
    fixtures = json.loads(FIXTURES.read_text())
    carrier, brainwave = sp.symbols("carrier brainwave")
    binaural_expr = str(sp.simplify(carrier + brainwave))

    return {
        "meta": {
            "binauralFormula": binaural_expr,
            "mixFormula": "clamp(mix, 0, 100) / 100 * 0.5",
            "strobeDuty": 0.5,
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
    }


if __name__ == "__main__":
    print(json.dumps(build_reference(), indent=2))
