# Cortex automated smoke scripts

## La verificación ocurre en CI

Este repo **no expone comando de verificación local**, y no hay que añadir uno. `light/` existe,
pero lo invoca el job `ligero` de CI por ruta; no se ofrece como algo que se pueda correr en la
máquina de trabajo. El resultado se lee en la corrida:

[`.github/workflows/ci.yml`](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml)
corre `ligero` (los cuatro chequeos estáticos), `suite` (Chromium), `motores` (timeline y UI en
los tres motores) y `matriz` (`browser-matrix.cjs`).

### `light/` — lo que invoca el job `ligero`

Node puro, sin navegador y sin dependencias, invocado por el workflow como
`node tests/light/run-light-verify.cjs`.

| Chequeo | Qué detecta |
|---|---|
| `inline-syntax` | Error de sintaxis en el JavaScript inline de `cortex.html` o `cortex.spec.html`, validado con `node --check` |
| `self-contained` | `<script src>`, `<link href>` o `fetch`/`XMLHttpRequest` hacia un origen remoto |
| `dom-references` | Un id pedido con `getElementById`/`$('#id')` que el markup no declara |
| `scenario-runner-shape` | Una entrada del arreglo `TESTS` sin `group`, `name` o `fn` |

Imprime una línea por chequeo con `PASS`/`FAIL` y escribe `artifacts/light-verify.json`, que el
job publica como artifact `light-verify`. Con un solo chequeo roto sale con código 1; sin
ningún chequeo registrado, con código 2 y sin escribir reporte, porque un reporte vacío no es un
verde.

Un verde de este job **no es** el verde de la suite con navegador: son jobs distintos de la
misma corrida. Y no simula audio, ni DOM, ni reloj de audio.

## La suite con navegador

Estos scripts requieren el paquete local de Playwright y un servidor sirviendo el workspace.
Ya no son el camino de verificación y no se invocan por omisión: se listan como referencia de
cómo se ejecuta la suite en un entorno con dependencias instaladas.

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

Levantar un navegador en la máquina de trabajo requiere pedirlo explícitamente; la regla está en
`AGENTS.md`.

El HTML runner `cortex.spec.html` es la suite de escenarios portátil y no depende de esta carpeta.
