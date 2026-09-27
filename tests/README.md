# Cortex automated smoke scripts

## Nivel ligero (sin navegador)

`light/` es el nivel de verificación por omisión del proyecto. Solo Node: sin `npm install`,
sin servidor, sin red y sin motor de navegador.

```bash
npm run verify:light
```

| Chequeo | Qué detecta |
|---|---|
| `inline-syntax` | Error de sintaxis en el JavaScript inline de `cortex.html` o `cortex.spec.html`, validado con `node --check` |
| `self-contained` | `<script src>`, `<link href>` o `fetch`/`XMLHttpRequest` hacia un origen remoto |
| `dom-references` | Un id pedido con `getElementById`/`$('#id')` que el markup no declara |
| `scenario-runner-shape` | Una entrada del arreglo `TESTS` sin `group`, `name` o `fn` |

Reporta una línea por chequeo con `PASS`/`FAIL` y escribe `artifacts/light-verify.json`.
Con un solo chequeo roto sale con código 1; sin ningún chequeo registrado, con código 2 y
sin escribir reporte, porque un reporte vacío no es un verde.

Un verde aquí **no dice nada sobre el comportamiento de la app**: no simula audio, ni DOM,
ni reloj de audio. La cobertura real la da la suite con navegador, que corre en CI.

## Suite con navegador (Playwright)

Estos scripts requieren el paquete local de Playwright y un servidor sirviendo el workspace.
**No son el camino por omisión**: la suite completa se verifica en CI
(`.github/workflows/ci.yml`).

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

Los tests que aceptan varios motores leen `ENGINE`:

```bash
ENGINE=firefox node tests/timeline-scheduling.cjs
```

El HTML runner `cortex.spec.html` es la suite de escenarios portátil y no depende de esta carpeta.
