# Cortex — reporte de verificación

**Fecha:** 2026-09-18  
**Cambio OpenSpec:** `cortex-specialized-testing`  
**OpenSpec:** 1.13.1, inicializado como skill compartida en `.agents/`  
**Fuente:** `Cortex-app.md` (se extrajeron los bloques más recientes de la app y del runner; no se recibió un repositorio original)

## Resultado ejecutivo

**Resultado: PASS con una corrección crítica aplicada.**

La primera prueba en navegador real encontró un fallo de ciclo de vida: después de `start → stop`, el tercer click intentaba reutilizar `OscillatorNode` detenidos y Chromium reportaba:

```text
Failed to execute 'start' on 'AudioScheduledSourceNode': cannot call start more than once.
```

Se corrigió `AudioEngine` para reconstruir el grafo/fuentes efímeras al reiniciar, y se condicionó el campo dinámico del radar a `state.playing`.

## Evidencia ejecutada

| Capa | Prueba | Resultado |
|---|---|---:|
| Sintaxis | `node --check` sobre los scripts embebidos de `cortex.html` y `cortex.spec.html` | PASS |
| OpenSpec | `openspec validate cortex-specialized-testing --strict --json` | 1/1 PASS |
| Suite mockeada | Runner `cortex.spec.html` en Chromium, AudioContext y Canvas spies | **72/72 PASS** |
| Audio real smoke | `start → stop → start`, con `AudioContext` real del navegador | PASS después de la corrección |
| Visual real | Canvas cambia con `stereo`, `f-mod`, `binaural`; bandas cerebrales cambian | PASS |
| Responsive | Viewports 1440×900 y 390×844, sin overflow horizontal ni errores | PASS |
| Mutation testing | Se forzó `if (state.playing)` → `if (true)`; la suite detectó el defecto | PASS, 1 fallo intencional detectado |

### Estados del smoke de audio real

```text
initial: detenido
first:   reproduciendo
second:  detenido
third:   reproduciendo
errors:  []
```

### Mutation testing

La mutación intencional produjo:

```text
72 tests ejecutados
71 pasaron · 1 falló
fallo detectado: detenido no dibuja campos dinámicos [radar/stopped]
```

Esto confirma que el test nuevo no es decorativo: detecta la regresión específica que se introdujo.

## Ronda de validación final — `cortex-final-validation`

| Gap | Resultado | Evidencia |
|---|---|---|
| WAV E2E | **PASS** | `tests/wav-e2e.cjs`, RIFF/WAVE válido, 2 canales, PCM 16-bit, 44.1 kHz, 60 s, RMS no nulo, sin clipping |
| Análisis de señal | **PASS** | muestras finitas, peaks dentro de rango y `clipRate = 0` en ambos canales |
| Snapshots radar | **PASS** | `artifacts/visual/radar-*.png`, diferencias: stereo 21.96%, f-mod 21.98%, binaural 11.94% |
| Snapshots cerebro | **PASS** | Delta/Alpha 22.54%, Alpha/Beta 50.15%, tolerancia de pixel 10 |
| Chromium | **PASS** | DOM, Canvas, AudioContext, lifecycle y download WAV |
| Firefox | **PASS** | matriz cross-browser con DOM, Canvas, lifecycle y WAV PCM16 |
| WebKit | **PASS** | matriz cross-browser con DOM, Canvas, lifecycle y WAV PCM16 |
| Protocolo de escucha | **MANUAL-PENDING** | `cortex-listening-protocol.md`; requiere auriculares/parlantes del usuario |
| HRTF real | **NO APLICA/BLOCKED** | Cortex no implementa una ruta HRTF; no se infiere desde el radar |

### Evidencia WAV

```text
format: PCM 16-bit
channels: 2
sampleRate: 44100 Hz
duration: 60 s
RMS: [0.1272635, 0.0905398]
peaks: [0.1799927, 0.1798706]
clipRate: [0, 0]
nonFinite: 0
```

### Matriz de navegadores

`tests/browser-matrix.cjs` ejecutó Chromium, Firefox y WebKit. Los tres motores devolvieron `PASS`; cada uno comprobó DOM/Canvas, lifecycle, descarga y parseo PCM16 del WAV, incluyendo formato, canales, frecuencia, duración, RMS, picos, clipping y valores finitos. Los binarios Firefox/WebKit y sus dependencias fueron instalados por Playwright antes de la ejecución.

### Protocolo manual pendiente

Se entregó `cortex-listening-protocol.md`. Falta que una persona lo ejecute con el dispositivo real y devuelva el registro. Hasta entonces el estado correcto es `MANUAL-PENDING`, no `PASS`.

## Correcciones aplicadas

1. **Reinicio de audio:** `AudioEngine.start()` ya no vuelve a llamar `start()` sobre fuentes usadas. Tras `stop()`, desconecta el grafo anterior y crea fuentes nuevas con el estado actual.
2. **Radar detenido:** stereo, f-mod, binaural, a-mod y noise ya no dibujan cobertura dinámica mientras `playing` es `false`. Se mantiene la geometría estática de la cabeza y el marcador central gris.
3. **Testabilidad:** `window.__CORTEX__` expone una superficie interna mínima para el runner.
4. **Aserciones:** la prueba binaural separa lóbulos reales de orejas/anillos base.

## Archivos

- `cortex.html`: app extraída y corregida.
- `cortex.spec.html`: suite visual/audio mockeada, 72 escenarios.
- `tests/noise-carrier.cjs`: contrato de la portadora de ruido filtrada.
- `tests/timeline-custom-presets.cjs`: timeline, loop y presets personalizados.
- `openspec/changes/cortex-timeline-custom-presets/`: propuesta aplicada para timeline y presets personalizados.
- `cortex-test-report.md`: este reporte.
- `cortex-test-report.png`: captura del reporte de la suite.
- `cortex-listening-protocol.md`: protocolo manual pendiente.
- `tests/wav-e2e.cjs`: descarga y parser WAV.
- `tests/snapshots.cjs`: snapshots y pixel diff.
- `tests/browser-matrix.cjs`: matriz Chromium/Firefox/WebKit.
- `artifacts/visual/`: PNGs y `snapshot-report.json`.
- `artifacts/browser-matrix.json`: resultados por motor.
- `openspec/changes/cortex-specialized-testing/`: proposal, spec, design y tasks.
- `openspec/changes/cortex-final-validation/`: proposal, spec, design y tasks.

## Límites que siguen abiertos

- No se validó la percepción subjetiva con oyentes ni el audio por DAC/auriculares.
- El radar es una visualización de intención/modulación; no mide HRTF real.
- El carrier senoidal no permite concluir percepción frente/atrás real.
- La suite Canvas de contrato valida geometría y llamadas; los snapshots actuales sí comparan PNGs, pero no sustituyen una evaluación visual humana.
- La matriz automatizada cross-browser ya pasó en Chromium, Firefox y WebKit; esto no sustituye una prueba por DAC/auriculares.
- La escucha subjetiva y la prueba por DAC/auriculares siguen pendientes del usuario.
- La fuente fue un transcript; antes de integrar en un repositorio de producción conviene comparar `cortex.html` con el código fuente canónico.

## Cómo repetir

```bash
# Servir los archivos
python3 -m http.server 4173 --bind 0.0.0.0

# Abrir el runner
# http://localhost:4173/cortex.spec.html

# Validar el cambio OpenSpec
npx --yes @fission-ai/openspec@latest validate cortex-specialized-testing --strict --json
```

Para el smoke automatizado con Playwright se requiere tener Chromium, Firefox y WebKit y sus dependencias instalados. La suite HTML sigue siendo ejecutable en un navegador normal.

## Evaluación de tooling open source

La evaluación detallada está en `openspec/changes/cortex-open-source-validation-tooling/tooling-evaluation.md`. La clasificación de gaps queda así:

| Gap | Herramienta / enfoque | Clasificación | Estado |
|---|---|---|---|
| Automatización y matriz cross-browser | Playwright | `ADOPT` | PASS en Chromium, Firefox y WebKit |
| Comparación estructural HTML/JS/CSS | Difftastic + ast-grep | `ADOPT` como auditoría de desarrollo | Evidencia en `artifacts/audit/` |
| Escucha subjetiva | webMUSHRA externo | `SPIKE` | Protocolo preparado; revisión legal y escucha humana pendientes |
| Lectura/render HRTF SOFA | libmysofa, libmysofa-wasm, Omnitone | `SPIKE` aislado | `NOT_EXECUTED`; no se integró parser/renderer en Cortex |
| Regresión visual alternativa | BackstopJS | `SPIKE` comparativo | 1.26% bruto frente a snapshot nativo; no se duplica tooling |
| Componentes aislados | Storybook | `SPIKE` condicionado | Esperar separación de componentes de `cortex.html` |
| Referencia espacial archivada | Resonance Audio | `REFERENCE-ONLY` | No recomendado para adopción nueva |
| Regresión visual archivada | Lost Pixel | `REJECT` | No recomendado como dependencia nueva |

Ninguna herramienta de esta tabla se convirtió en dependencia de producción. Un WAV válido, separación estéreo, `StereoPannerNode`, snapshot/diff visual o PASS cross-browser no se presenta como evidencia de HRTF real.

## Cambio de portadora de ruido — `cortex-modulated-noise-carrier`

La ruta Noise fue ajustada después de comparar su comportamiento con BrainAural. Ya no conecta ruido blanco crudo directamente al master: ahora utiliza fuentes L/R independientes, filtros bandpass centrados en `Carrier`, crossfade entre senoide y ruido, y modulación del centro del filtro mediante `f-mod`. La exportación WAV replica la misma ruta con `OfflineAudioContext`.

| Prueba | Resultado |
|---|---:|
| Sintaxis JavaScript | PASS |
| Contrato de ruido (`tests/noise-carrier.cjs`) | PASS |
| Chromium | PASS |
| Firefox | PASS |
| WebKit | PASS |
| Snapshots visuales | PASS |
| Escucha humana | MANUAL-PENDING |

El cambio mejora el diseño de señal, pero no convierte la ruta en HRTF ni demuestra efectos neurológicos. Falta escuchar la nueva versión con volumen bajo y registrar si el ruido dejó de percibirse como fondo indiferenciado.

## Cambio de timeline y presets personalizados — `cortex-timeline-custom-presets`

Se aplicó el popup de timeline y el editor de presets personalizados. El timeline admite una cantidad arbitraria de pasos, duración editable debajo de cada cuadrado, reordenamiento, duplicación, eliminación, reproducción, pausa, detención y loop infinito. Los presets personalizados guardan el estado completo de audio, un nombre y un emote; la banda se calcula automáticamente mediante `bandFromFreq`.

| Prueba | Resultado |
|---|---:|
| Chromium | PASS |
| Firefox | PASS |
| WebKit | PASS |
| Crear preset/emote/banda automática | PASS |
| Persistencia y datos corruptos | PASS |
| Duración, loop y stop | PASS |
| Suite mockeada principal | 72/72 PASS |
| Escucha manual del timeline | MANUAL-PENDING |

El loop se detiene explícitamente con el control `Detener` o al detener el audio principal. La banda y el emote son etiquetas de interfaz; no constituyen un diagnóstico ni una afirmación terapéutica.
