# Cortex — reporte de estabilidad temporal y de UI

**Fecha:** 2026-09-26
**Cambio OpenSpec:** `cortex-timing-and-ui-stability`
**Capabilities:** `ui-stability`, `timeline-scheduling`
**Alcance:** los dos defectos reportados — la UI que "enloquecía" al mover un control rápido y las transiciones del timeline que solo ocurrían con la pestaña visible.

## Resultado ejecutivo

**Resultado: PASS en verificación automatizada, con una corrección aplicada durante la implementación.**

El cambio migra la progresión del timeline al reloj de `AudioContext` y acota el trabajo de DOM de la interfaz a una pasada por frame. Durante la implementación, la verificación automatizada detectó tres defectos que quedaron corregidos:

1. `remainingMs` quedó como campo estático en vez de valor vivo: el texto de estado mostraba la duración completa del paso como si fuera el tiempo restante.
2. El `setInterval` de 100 ms que refrescaba el cerebro se eliminó, pero el pulso de regiones se mudó a una custom property CSS sin inicializar en el primer frame.
3. Al ajustar los casos de UI de `cortex.spec.html` se introdujo una declaración `const` dentro del literal del array `TESTS`, lo que rompía el parseo de la página de specs completa. Detectado por el parseo del script.

## Qué cambió

| Capa | Antes | Después |
|---|---|---|
| Base temporal del timeline | `setTimeout` + `Date.now()` (reloj de pared) | `AudioContext.currentTime` con tick de anticipación y catch-up idempotente |
| Límite de un paso | `reschedule()` con piso artificial de 1000 ms | límite recalculado desde el reloj de audio, sin piso |
| Fin de secuencia | avance directo a `index + 1` | fast-forward: solo se aplica el paso que corresponde a "ahora" |
| Pausa | `remainingMs` estimado restando tiempo de pared | restante congelado desde el reloj de audio |
| Regreso a la pestaña | ninguno | resync en `visibilitychange` (estado, resaltado y restante reales) |
| Readouts | ancho variable, escritura por evento `input` | cifras tabulares + ancho reservado en `ch`, y dirty check |
| Trabajo de DOM | `updateBrain()` completo por evento | información de banda solo al cruzar de banda; resto coalescido en una pasada por frame |
| Pulso de regiones | `style.opacity` por nodo y por tick | una custom property CSS por frame |
| Onda | fase acumulada por frame (framerate-dependent) | fase derivada del tiempo transcurrido |

## Evidencia ejecutada

Verificación por DevTools Protocol sobre el Chromium del sistema, con `AudioContext` real. Los escenarios se ejecutan en páginas nuevas para no heredar estado.

| Capa | Prueba | Resultado |
|---|---|---:|
| Sintaxis | `node --check` sobre el script embebido de `cortex.html` | PASS |
| Sintaxis | `node --check` sobre `tests/timeline-scheduling.cjs` y `tests/ui-stability.cjs` | PASS |
| Suite in-page | Runner de `cortex.spec.html` (13 grupos, AudioContext y Canvas mockeados) | **72/72 PASS** |
| Timeline | 9 escenarios: normal, timers retrasados 2 s, fast-forward, loop, pausa/reanudación, edición de duración, limpieza, resync, vacío | **51/51 PASS** |
| UI | 34 comprobaciones: ancho, dirty check, coalescing, banda, pulso, framerate | **34/34 PASS** |
| Visually | Captura con portadora de 4 dígitos y moduladores al 100 % | PASS, sin truncado ni desalineación |

### Comportamiento clave observado

Con todos los temporizadores de la página retrasados 2 s (equivalente a una pestaña estrangulada), el reproductor **no se adelanta**:

```text
audio:  0.58s  0.77s  0.98s  1.17s  1.39s
idx:       0      0      0      0      0     ← los timers siguen sin llegar
rem:     787ms  595ms  381ms  189ms     0ms   ← lo decide el reloj de audio
```

Y al recuperar el control, aplica **un solo paso** (el resultante), no los que quedaron atrás:

```text
congelado 2.6 s → pasos aplicados: [0, 2]     (el 1 nunca se aplicó)
```

## Pruebas añadidas

| Archivo | Cubre |
|---|---|
| `tests/timeline-scheduling.cjs` | contrato temporal completo: reloj de audio,Background, fast-forward, loop, pausa, edición de duración, limpieza, resync |
| `tests/ui-stability.cjs` | ancho estable, dirty check, coalescing por frame, banda, pulso por variable CSS, independencia del framerate |

Ambos siguen la convención del repo: `ENGINE=chromium|firefox|webkit`, puerto `4173` (o `PORT`), y marcan `BLOCKED` con salida 0 cuando el motor no está instalado, como hace `browser-matrix.cjs`.

## Qué se considera estable

- El ancho de `.ctrl-val` y `.mod-val` no depende del valor: es la condición observable de que el panel no se rearranca. Si un cambio futuro altera el `min-width` en `ch`, esa propiedad es la que hay que volver a medir.
- La información de banda solo se escribe al cruzar de banda: se verifica con un `MutationObserver` sobre `bandDesc`.
- Una ráfaga de N eventos `input` produce exactamente una pasada de UI por frame, medido con el contador `getUiPasses()`.
- Ninguna región del cerebro lleva estilo inline: el pulso se propaga con `--brain-pulse`.
- La fase de la onda depende del tiempo transcurrido: dos frames de 120 Hz y un frame de 60 Hz producen el mismo `elapsedMs`.

## Limitaciones de esta verificación

- **Playwright no está instalado en esta máquina**, por lo que los dos archivos de prueba nuevos se escribieron y revisaron contra la convención del repo, pero **no se ejecutaron**. La verificación equivalente se hizo por DevTools Protocol. Las tareas 4.4 y 4.5 quedan abiertas por esto.
- Playwright no reproduce el estrangulamiento real de temporizadores del navegador. La simulación retrasa los timers de la página; el comportamiento real del navegador puede ser más agresivo (Chrome llega a una ejecución por minuto tras 5 min oculto). El diseño lo cubre con el fast-forward, pero eso no se ha medido en un navegador real.
- `Page.setWebLifecycleState('frozen')` quedó como prueba opcional de Chromium: no se ejecutó.
- No se regeneraron los PNG de `artifacts/visual/` con el runner del proyecto. Se capturó una pantalla equivalente para inspección visual.

## Pendiente de verificación humana

- **5.3** — Secuencia larga con la ventana minimizada y con la pestaña en segundo plano, con auriculares a volumen bajo. Es la única forma de cerrar el requisito de fondo del proyecto: la escucha sigue siendo humana.
