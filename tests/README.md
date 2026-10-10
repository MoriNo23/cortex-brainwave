# Los unitarios de Cortex

## La verificación ocurre en CI

Este repo **no expone comando de verificación local**, y no hay que añadir uno. Cada test de
`tests/` lo invoca el workflow por ruta; no se ofrece como algo que se corra en la máquina de
trabajo. El resultado se lee en la corrida:

[`.github/workflows/ci.yml`](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml)
corre dos jobs, **ninguno con navegador**: `ligero` (estáticos + unitarios con Node a pelo) y
`build-y-math` (build de Astro, estático del build, Worker minificado y referencia matemática
Python↔JS).

## El patrón: fuentes reales + simulación

Todos los unitarios importan los módulos reales de `src/lib` y simulan lo que el navegador
proveería — motor de audio con nodos falsos, reloj `ctx.currentTime` controlado, DOM mínimo,
`OfflineAudioContext`. Verifican lógica; nunca declaran que validaron audio o navegador reales.

| Test | Qué verifica |
|---|---|
| `light/run-light-verify.cjs` | Estáticos: `dom-references` (ids pedidos por `src/` declarados en el markup) |
| `light/checks/dist-references.cjs` | El HTML de `dist/` referencia JS/CSS existentes (lo invoca `build-y-math` tras el build) |
| `strobe-worker.cjs` | El fuente del Worker del estrobo en `vm`: intensidad y pintado idénticos al hilo principal; con esbuild disponible, también sobre el bundle minificado |
| `mix-integrity.cjs` | Volumen y portadora frente al timeline y al stop suave; rampas del motor ancladas al valor actual |
| `timeline-logic.cjs` | Orden de pasos, duraciones de transición, interpolación, pausa, catch-up, loop, reprogramación |
| `wav-export.cjs` | El RIFF del export: header, duración, sin NaN, no-silencio, canales L≠R con binaural, clipping |
| `noise-carrier.cjs` | Cableado del motor: filtros bandpass L/R, crossfade portadora↔ruido, centro sigue a `Carrier`, `noiseFilterDepthValue` |
| `strobe-window.cjs` | La ventana flotante única con DOM simulado: apertura, cambio de Hz, cierre, cero superficies huérfanas |
| `keyboard-shortcuts.cjs` | Guardas de foco de los atajos: con el foco en un input la tecla escribe y no dispara transporte |

## Reportes

`light/run-light-verify.cjs` imprime una línea por chequeo y escribe
`artifacts/light-verify.json`, que el job publica como artifact `light-verify`; los de build y
matemática, como artifact `build-y-math`. Con un chequeo roto sale con código 1; sin ningún
chequeo registrado, con código 2 y sin escribir reporte, porque un reporte vacío no es un
verde.

Lo que estos tests no cubren —escucha, confort visual, la ventana flotante en un escritorio
real— está listado como verificación humana en `AGENTS.md`, con su protocolo. Levantar un
navegador en la máquina de trabajo requiere pedirlo explícitamente; la regla está en `AGENTS.md`.
