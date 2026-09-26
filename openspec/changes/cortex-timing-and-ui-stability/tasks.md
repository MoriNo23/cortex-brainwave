# Tasks

## 1. Estabilidad de layout de los readouts

- [x] 1.1 Añadir una regla CSS compartida de readouts (`font-variant-numeric: tabular-nums` más `min-width` en `ch` con `text-align: right`) que cubra `.ctrl-val`, `.mod-val` y el beat de la barra de estado, y verificar midiendo en el navegador que `0%` → `100%` y `0.5 Hz` → `50.0 Hz` no alteran el ancho del bloque ni desplazan a los vecinos.
- [x] 1.2 Añadir un helper de escritura con dirty check que compare antes de asignar `textContent`, y verificar con un contador de escrituras que re-aplicar el mismo valor no produce ninguna escritura en el DOM.

## 2. Planificador de frame único

- [x] 2.1 Implementar un planificador de frame con conjunto de "sucio" y una única pasada por frame, y verificar que una ráfaga de eventos `input` dentro del mismo frame produce una sola pasada de UI.
- [x] 2.2 Migrar los handlers de `bindEvents()` (brainwave, carrier y los seis moduladores) al patrón "estado y motor de inmediato + marca de sucio", y verificar que el `AudioEngine` refleja la entrada sin retraso perceptible y que la UI converge al valor final.
- [x] 2.3 Separar `updateBrain()` manteniendo `state.band` sincrónico y recalculando nombre, rango, descripción, resaltado de regiones y de presets solo cuando cambia la banda, y verificar que moverse dentro de una banda no escribe esos nodos mientras que cruzarla sí los actualiza.
- [x] 2.4 Trasladar el pulso de regiones al planificador usando una única custom property CSS y eliminar el `setInterval(…, 100)` de `init()`, y verificar que el pulso sigue sincronizado con la frecuencia y que ya no hay escrituras de estilo inline por nodo y por tick.
- [x] 2.5 Hacer `drawWaveFrame()` independiente de la tasa de refresco derivando la fase del tiempo transcurrido en lugar de acumular por frame, y verificar que la fase resulta función del tiempo y no del número de frames renderizados.

## 3. Base temporal de audio para el timeline

- [x] 3.1 Introducir la abstracción de reloj de audio y el tick de catch-up con hook `onStep`, conservando la superficie observable `running`, `paused`, `index` y `remainingMs`, y verificar que `tests/timeline-custom-presets.cjs` sigue pasando sin cambios.
- [x] 3.2 Migrar `play`, `startStep` y `advance` al reloj de audio, eliminando `Date.now()` y el `setTimeout` como fuente de verdad del fin de paso, y verificar que la secuencia y el loop se comportan igual con la prueba existente.
- [x] 3.3 Implementar fast-forward para que, si vencieron varios límites, se aplique solo el paso resultante, y verificar con una prueba de límites múltiples que no hay doble aplicación ni pasos intermedios aplicados.
- [x] 3.4 Corregir `pause()`, la reanudación y `reschedule()` sobre el reloj de audio eliminando el piso de 1000 ms, y verificar que ciclos repetidos de pausa y reanudación no acortan ni alargan el paso.
- [x] 3.5 Implementar el resync en `visibilitychange` para que estado, resaltado del paso actual y tiempo restante reflejen la posición real, y verificarlo sobreescribiendo `document.hidden` y `visibilityState` y despachando el evento.
- [x] 3.6 Añadir guardas para contexto de audio suspendido y desuscripción de temporizadores al detener, y verificar que tras `stop` no queda nada pendiente que pueda aplicar un paso más tarde.

## 4. Pruebas

- [x] 4.1 Crear `tests/timeline-scheduling.cjs` con el caso de núcleo que retrasa artificialmente `setTimeout`/`setInterval` y afirma que la progresión sigue alineada al reloj de audio, sin doble aplicación y sin deriva acumulada entre pasos.
- [x] 4.2 Extender esa prueba con el caso de catch-up de varios límites vencidos y con la resincronización al volver de una pestaña oculta.
- [x] 4.3 Crear la prueba de layout y dirty check: ancho de readout estable bajo arrastre rápido y ausencia de escrituras cuando el valor no cambia.
- [x] 4.4 Ejecutar la suite existente completa (`timeline-custom-presets`, `noise-carrier`, `wav-e2e`, `visual-smoke`, `responsive-smoke`, `snapshots`) y la matriz Chromium/Firefox/WebKit, y registrar el resultado en los reportes de `artifacts/`.
- [x] 4.5 Regenerar los PNG de `artifacts/visual/` y dejar por escrito en el reporte qué se considera estable, incluyendo la limitación de que Playwright no reproduce el estrangulamiento real de temporizadores del navegador.

## 5. Cierre

- [x] 5.1 Documentar en el glosario y en la UI que la progresión temporal usa el reloj del contexto de audio y cuál es el retraso máximo del catch-up, sin convertirlo en afirmación médica.
- [x] 5.2 Validar el cambio con `openspec validate cortex-timing-and-ui-stability --strict --json` y dejar el resultado anotado.
- [ ] 5.3 Prueba manual de una secuencia larga con la ventana minimizada y con la pestaña en segundo plano, verificando que las transiciones entre pasos ocurren igual. (Requiere observación y escucha humana; verificar también que al volver la UI muestra la posición real.)
