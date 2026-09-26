# Proposal

## Why

Dos defectos observados por el usuario commitment invalidan el uso diario de Cortex y bloquearían cualquier feature posterior:

1. **La UI "enloquece" al mover un control rápido.** Los readouts numéricos cambian de ancho en cada evento (`0%` → `100%`) y el panel se rearranca; además `updateBrain()` ejecuta una búsqueda global en el DOM y escribe cinco `textContent` por cada evento `input`, con reflows a la frecuencia del puntero.
2. **Las transiciones del timeline solo ocurren con la pestaña visible.** `TimelinePlayer` se apoya en `setTimeout` y `Date.now()`; los navegadores estrangulan los timers en segundo plano (mínimo 1 s, y tras 5 min ocultos, una ejecución por minuto), de modo que el audio sigue sonando pero la secuencia nunca avanza.

El segundo defecto no es solo un bug de reproducción: es la razón por la que las rampas largas, el fade-out de sueño, el parpadeo fótico y los cues de TMR no pueden construirse encima. El reloj de audio (`AudioContext.currentTime`) es la única base temporal que el navegador no estrangula, porque las automatizaciones de `AudioParam` se ejecutan en el hilo de audio. Por eso este cambio es la fundación de la hoja de ruta, no un parche suelto.

## What Changes

- Los readouts numéricos (`.ctrl-val`, `.mod-val`, beat de la barra de estado) pasan a cifras tabulares con ancho fijo: el valor deja de cambiar el ancho del bloque y el resto del panel deja de moverse.
- Los handlers de los sliders se **coalescen**: como máximo una actualización de UI por frame (`requestAnimationFrame`) en lugar de una por evento `input`. El estado sonoro sigue reflejándose de inmediato; lo que se limita es el trabajo de DOM.
- `updateBrain()` se divide en dos responsabilidades: la **información de banda** (nombre, rango, descripción, resaltado de regiones y presets) solo se recalcula al cruzar de banda, y el **readout numérico** más el pulso de regiones se actualizan como máximo una vez por frame.
- Se eliminan las escrituras de `textContent` cuyo valor no cambió (dirty check), y el pulso de regiones deja de escribir estilos inline en cada nodo y en cada tick.
- `TimelinePlayer` deja de depender de `setTimeout`/`Date.now` y se programa contra `AudioContext.currentTime` con ventana de anticipación (patrón "A Tale of Two Clocks"): las transiciones de paso se ejecutan aunque la pestaña esté oculta o la ventana minimizada.
- Se corrigen dos defectos de cálculo ya presentes en el player: `reschedule()` fuerza un mínimo de 1000 ms restantes y `pause()` acumula la deriva del reloj de pared.
- `drawWaveFrame()` deja de acumular fase por frame: la animación pasa a derivarse del tiempo transcurrido, con lo que una pantalla de 120 Hz ya no muestra la onda al doble de velocidad que una de 60 Hz.
- Se conserva la superficie observable del player (`running`, `index`, `paused`, `remainingMs`) para no romper el contrato con las pruebas existentes.
- No hay cambios de UI visibles deliberados, no se agregan dependencias y se mantiene el HTML autónomo. No hay cambios **BREAKING**.

## Capabilities

### New Capabilities
- `ui-stability`: estabilidad temporal y de layout de los readouts y visualizadores ante interacción rápida — cifras tabulares, ancho fijo, coalescing por frame, dirty check y animaciones independientes del framerate.
- `timeline-scheduling`: contrato temporal de la reproducción del timeline — el reloj de audio es la fuente de verdad, las transiciones de paso se ejecutan en segundo plano y `pause`/`reschedule` no introducen deriva.

### Modified Capabilities
- Ninguna. `openspec/specs/` está vacío: las capabilities en vuelo (`timeline-custom-presets`, `audio-noise`, `cortex-testing`, `final-validation`, `tooling-evaluation`) siguen sin archivar y esta propuesta no altera sus requisitos. El comportamiento de UI del popup del timeline sigue perteneciendo a `timeline-custom-presets`; aquí solo se define quién manda en el tiempo.

## Impact

- `cortex.html`:
  - CSS de `.ctrl-val` (línea ~132) y `.mod-val` (línea ~376).
  - `bindEvents()` (~1794): handlers de `sliderBrainwave`, `sliderCarrier` y los seis moduladores.
  - `updateBrain()` (~1519), `syncUIFromState()` (~1644), `applyPreset()` (~1553).
  - `drawWaveFrame()` (~1318), `renderLoop()`/`init()` (~1909-1931), incluido el `setInterval` de 100 ms que escribe opacidades.
  - Clase `TimelinePlayer` (~828-918) y `formatDuration()` (~920).
- Contrato de pruebas: `window.__CORTEX__.getTimelinePlayer()` se mantiene; `tests/timeline-custom-presets.cjs` sigue siendo válido, aunque su cobertura debe extenderse al comportamiento en pestaña oculta.
- Pruebas visuales: `tests/visual-smoke.cjs`, `tests/responsive-smoke.cjs` y `tests/snapshots.cjs` reaccionan a los cambios tipográficos. Los PNG de `artifacts/visual/` están en `.gitignore`, así que no hay baseline que versionar; sí conviene fijar en el plan de pruebas qué se considera estable.
- Sin dependencias nuevas, sin bundler, sin cambios en el grafo de audio (`AudioEngine` conserva su topología).
