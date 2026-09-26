# Cortex — reporte de transiciones del timeline

**Fecha:** 2026-09-26
**Cambio OpenSpec:** `cortex-timeline-transitions`
**Capability:** `timeline-transitions`
**Origen de las features:** `Documentos/cortex.html`, evolución paralela del usuario con dos capacidades que no estaban en el repositorio.

## Resultado ejecutivo

**Resultado: PASS en CI completa.** Las dos features se recuperaron y se adaptaron al motor actual: transición suave entre pasos (interpolación de los ocho parámetros de audio) y edición de duraciones en segundos o minutos. No se portó el reproductor de la versión paralela (rAF + `performance.now()`, que no corre con la pestaña oculta) ni el script de Cloudflare que ese archivo arrastraba de su descarga.

## Qué se portó y qué se adaptó

| Pieza | Origen paralelo | En esta versión |
|---|---|---|
| `interpolateAudioState` y familia de unidades | tal cual (funciones puras) | tal cual |
| Interpolación por frame de rAF | `requestAnimationFrame` a 60 fps | tick de 60 ms contra `ctx.currentTime` |
| Progreso de rampa | `transitionElapsedMs` propio (reloj de pared) | `transitionStartedAt` sobre el reloj de audio |
| Pausa de la rampa | recompute manual | congelada: sin ticks no hay interpolación |
| UI durante la rampa | `syncUIFromState()` completo a 60 fps | `markUiDirty('controls')`: una pasada por frame |
| Configuración en vivo | `refreshTransition()` con reanclaje de pared | `refreshTransition()` sobre el reloj de audio, continuo |

## Evidencia en CI

Workflow `ci.yml`, corrida `36277621694` (5/5 jobs ✓) más la corrida final con cobertura de escenarios clockless.

| Suite | Chromium | WebKit | Firefox (headless sin audio) |
|---|---:|---:|---:|
| In-page (`cortex.spec.html`) | 79/79 ✓ | — | — |
| Programación temporal | 48/48 ✓ | 48/48 ✓ | 0/0 · 9 SKIP (reloj suspendido) |
| Transiciones | 36/36 ✓ | 36/36 ✓ | 8/8 ✓ en escenarios clockless (unidades, persistencia, legacy); los de rampa SKIP |
| Estabilidad de UI | 28/28 ✓ | 28/28 ✓ | BLOCKED (reloj) |
| Matriz de navegadores | ✓ | ✓ | ✓ |

Los escenarios de unidades y persistencia se marcaron como `needsClock: false`: son UI y localStorage puros y ahora sí corren en Firefox, que en un runner sin dispositivo de audio deja el contexto suspendido (documentado en `cortex-stability-report.md`).

### Verificación local por DevTools Protocol

38/38 comprobaciones sobre el Chromium del sistema, incluidas: interpolación exacta (0 = origen, 1 = destino, 0.5 = media), rampa completa con intermedios distintos de ambos extremos y convergencia al preset, status "· transición", corte directo, edición en vivo sin reiniciar el paso, pausa a mitad de rampa con reanudación convergente, unidades s/min, persistencia y datos legacy.

## Hallazgos del proceso

1. **La rampa sí funciona; el primer arnés decía lo contrario.** El primer informe mostró "fallos" que eran del diseño del arnés: reutilizaba la página entre escenarios, así que los presets cortados dejaban el estado "ya en el destino" y las rampas siguientes iban de 2→2 (sin movimiento). Cada escenario debe partir de un estado conocido.
2. **rAF puede dejar de disparar en un target headless largo.** Al final de una sesión de verificación de varios minutos, el render loop del target dejó de correr: el estado de audio seguía moviéndose (el tick es `setInterval`) pero los sliders quedaron congelados porque el coalescing depende de rAF. Por eso el escenario de coalescing corre en una página recién cargada. No es un defecto de la app; sí una advertencia para cualquier verificación headless larga.
3. **El mock de `cortex.spec.html` congela `currentTime` en 0.** El caso de rampa de la suite in-page ancla `transitionStartedAt` hacia atrás para simular el tiempo, y el timing real queda en la suite E2E con reloj vivo.
4. **`browser.newPage()` crea un contexto por escenario.** El escenario de persistencia leía un `localStorage` vacío tras la recarga porque el contexto no viaja entre escenarios; se hizo autosuficiente (edita, persiste y recarga en su propia página).

## Trade-off documentado

- La rampa avanza por el tick de 60 ms, no por automatización compilada de `AudioParam`. Bajo estrangulamiento intensivo (un tick por minuto), una rampa de 2 s puede aterrizar con un salto tardío, igual que la progresión de pasos: el retraso no se acumula y el estado final es el correcto. La vía de precisión de muestra (D1b del design de `cortex-timing-and-ui-stability`) queda reservada.
- `mix` (volumen global) se interpola igual que en la versión paralela. Si en escucha humana resulta incómodo, se excluye de `AUDIO_KEYS` de interpolación: ajuste de una línea (tarea 6.4).

## Pendiente de verificación humana

- **6.4** — Sesión con una rampa de 10 s entre Theta y Alpha con la ventana minimizada, auriculares a volumen bajo. Verificar: (a) que la interpolación se escucha como un glissando continuo y no como saltos, (b) si el cambio gradual de volumen (`mix`) resulta cómodo o conviene excluirlo de la interpolación, (c) que al volver a la ventana el status y los sliders reflejan la posición real de la rampa.
