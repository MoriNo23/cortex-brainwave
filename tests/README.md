# Cortex automated smoke scripts

These scripts require the local Playwright package and a server serving the workspace:

```bash
npm install --no-save playwright@1.63.0
python3 -m http.server 4173 --bind 0.0.0.0
node tests/run-cortex-tests.cjs
node tests/real-smoke.cjs
node tests/visual-smoke.cjs
node tests/responsive-smoke.cjs
node tests/mutation-smoke.cjs
node tests/wav-e2e.cjs
node tests/snapshots.cjs
node tests/browser-matrix.cjs
```

`wav-e2e.cjs` parses the downloaded PCM WAV and checks RIFF/WAVE metadata, duration, RMS, finiteness and clipping. `noise-carrier.cjs` verifies the filtered noise graph, zero/100% crossfade, carrier/f-mod tracking and a noise-enabled WAV export. `timeline-custom-presets.cjs` verifies custom preset creation, automatic band identification, timeline durations, loop and stop. `snapshots.cjs` writes deterministic PNGs and a pixel-diff report under `artifacts/visual/`. `browser-matrix.cjs` runs available engines, parses PCM16 WAV samples in each engine, and marks missing Firefox/WebKit installations as `BLOCKED`.

The HTML runner `cortex.spec.html` is the portable test suite and does not require this folder.
