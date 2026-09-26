# Design

## Context

Estado actual relevante para el enfoque (la motivación está en `proposal.md`):

- `TimelinePlayer` (`cortex.html` ~828-918) decide el fin de un paso con `setTimeout(() => this.advance(), remainingMs)` y mide el tiempo con `Date.now()`. `reschedule()` impone un piso de 1000 ms (`Math.max(1000, …)`) y `pause()` resta el elapsed de pared, que es la fuente de las dos derivas actuales.
- `bindEvents()` (~1794-1824) escribe el `textContent` del readout en cada evento `input` y llama a `updateBrain()` completo. `updateBrain()` (~1519-1550) hace tres `querySelectorAll` globales, alterna clases en regiones y presets, y escribe cinco `textContent` — uno de ellos `bandDesc`, un párrafo que altera el layout del panel.
- `init()` (~1930) añade un `setInterval(…, 100)` que llama a `updateBrain()` mientras suena el audio, y ese mismo paso escribe `style.opacity` en cada región activa.
- `.ctrl-val` (~132) reserva `min-width: 62px`; `.mod-val` (~376) no reserva ancho. No hay `font-variant-numeric: tabular-nums` en el documento.
- `drawWaveFrame()` (~1318) acumula `wavePhase += 0.008 * (1 + freq * 0.05)` por frame renderizado, con lo que la velocidad de la onda depende de la tasa de refresco.
- El motor ya programa sobre el hilo de audio: todas las actualizaciones de `AudioParam` usan `linearRampToValueAtTime(v, t + 0.05)` (~1267-1298). No hay `AnalyserNode` en el grafo.
- Contrato de pruebas en uso: `tests/timeline-custom-presets.cjs` lee `state.playing`, `state.band`, `timelineState.steps`, `timelineState.loop` y `getTimelinePlayer().{running,index,paused}` desde `window.__CORTEX__`; `tests/noise-carrier.cjs` inspecciona `engine.nodes`. La matriz corre en Chromium, Firefox y WebKit.
- Restricción del proyecto: HTML autónomo, sin bundler ni dependencias de producción (decisión registrada en `openspec/changes/cortex-timeline-custom-presets/proposal.md`).

## Goals / Non-Goals

**Goals:**

- Que el reloj de `AudioContext` sea la única fuente de verdad temporal del timeline, con un componente de retraso acotado y no acumulativo.
- Que ninguna operación de control (pausa, reanudación, edición de duración) introduzca deriva ni pisos ocultos.
- Que el trabajo de DOM por frame esté acotado a una pasada, con ancho de readout estable.
- Que la animación no dependa de la tasa de refresco.
- Preservar intacta la superficie de pruebas existente.

**Non-Goals:**

- Autoría de rampas o crossfades entre pasos, sesiones guiadas, dock estilo editor, parpadeo fótico, cama de ruido y `AnalyserNode`: son cambios posteriores y este diseño no los implementa.
- No cambiar la topología del grafo de audio ni el formato de persistencia (`cortex-timeline-v1` conserva `durationSeconds` en segundos).
- No introducir un framework, bundler o dependencia; no rediseñar visualmente la app.

## Decisions

### D1. Base temporal: reloj de audio con tick de anticipación y catch-up idempotente

El player se reescribe sobre una abstracción de reloj (`now()` = `engine.ctx.currentTime`) y un tick corto que recalcula el límite del paso actual. Cuando `now()` supera el límite, se avanza. La misma comprobación se invoca desde el tick, desde un `setTimeout` de respaldo para el límite exacto y desde `visibilitychange`.

Se evaluaron tres alternativas:

- **(a) Mantener `setTimeout` y compensar al volver a la pestaña.** Descartada: no sobrevive al estrangulamiento intensivo de Chrome (una ejecución por minuto tras 5 min oculto), que es exactamente el síntoma reportado. Compensar al volver solo arregla el final, no la transición.
- **(b) Compilar el timeline completo a automatización de `AudioParam` con `setValueAtTime(v, boundary)`.** Es la vía de exactitud de muestra y la más inmune al throttling, pero interactúa mal con pausa, stop y edición de duración: cada uno exige cancelar y recompilar, y un paso que dependa de una acción del usuario no se puede agendar por adelantado. Se reserva como posible modo futuro (ver Open Questions), no como base.
- **(c) Tick de anticipación sobre el reloj de audio con catch-up idempotente. Elegida.** El retraso queda acotado por el intervalo de catch-up y, sobre todo, no se acumula: el límite de cada paso se recalcula desde `ctx.currentTime`, así que un tick tardío no empuja los límites siguientes. Además es la base que necesitarán las rampas largas y el phase-lock del flicker.

Consecuencias de diseño que se aceptan explícitamente:

- **Fast-forward:** si al despertar el tick detecta que pasaron varios límites, aplica solo el paso resultante, no los intermedios. Es lo que exige el escenario de catch-up de la spec, y evita aplicar N snapshots en ráfaga.
- **Tolerancia declarada:** el retraso máximo de una transición es el intervalo de catch-up; no se promete exactitud de muestra. Se documenta en la spec con esa limitación en lugar de prometer lo que el navegador no garantiza.
- **Contexto suspendido:** `ctx.currentTime` no avanza si el `AudioContext` está suspendido. El player trata `ctx.state !== 'running'` como no reproducido, y `play()` sigue dependiendo del gesto del usuario que ya existe en `btnPlay`.

### D2. Un único punto de coalescencia de UI en vez de disciplina por handler

Se introduce un planificador de frame con conjunto de "sucio": los handlers de `input` actualizan `state` y el motor **de inmediato** (el sonido no espera) y marcan qué partes de la UI están sucias; una única pasada por frame aplica los textos y el pulso.

Se evaluaron: throttling por control (repetitivo, y N controles significan N pasadas por frame), coalescing por handler (cumple el requisito por convención, no por estructura) y un planificador global. Se elige el global porque hace que "como máximo una actualización por frame" sea una propiedad estructural y auditable, y porque acota el trabajo total cuando varios controles se mueven a la vez.

### D3. Estabilidad de ancho: cifras tabulares más ancho reservado en `ch`

Todos los readouts (`ctrl-val`, `mod-val`, beat de la barra de estado) comparten una regla con `font-variant-numeric: tabular-nums` y `min-width` expresado en `ch`, manteniendo `text-align: right`.

Se evaluaron: ancho fijo en píxeles (se rompe con el fallback de la webfont cuando se carga sin IBM Plex Mono), `min-width` ya existente solo en `.ctrl-val` (insuficiente: `.mod-val` no reserva y es la causa del rebote en un `flex` con `space-between`), y ajustar el ancho desde JS. Se elige el par tabular + `ch` porque el avance de dígito deja de variar con el valor y `ch` se adapta a la métrica real de la fuente en uso, incluido el fallback offline. Dirty check de escrituras: sin cambio de valor no se escribe, y no hay invalidación de layout.

### D4. `updateBrain()` se parte en dos, conservando `state.band` sincrónico

`state.band` se sigue asignando en cada cambio de `brainwave` —`tests/timeline-custom-presets.cjs` lo lee— pero la parte de DOM (nombre, rango, descripción, resaltado de regiones y presets) solo se recalcula cuando `bandFromFreq()` devuelve una banda distinta. El pulso y los readouts numéricos pasan al planificador de frame. `updateBrain` sigue exportada en `window.__CORTEX__` para no romper el contrato.

### D5. Animación en tiempo, no en frames

`wavePhase` deja de acumular incrementos por frame: se deriva del tiempo transcurrido acumulado en milisegundos, de modo que la misma configuración produce la misma velocidad aparente en 60 Hz y 120 Hz. El pulso de regiones ya usaba `Date.now()` y se mantiene, pero se traslada a la pasada por frame.

Se evaluó dejar el acumulador y dividir por una estimación de refresco (más frágil: requiere medir el refresco para corregir la corrección) — descartado a favor de integrar el tiempo en la unidad de estado del visualizador.

### D6. Pulso de regiones con una variable CSS en lugar de N escrituras inline

Se escribe una única custom property por frame en un contenedor y las regiones la consumen con `opacity: var(--pulse)`. El resultado visual es idéntico y el trabajo por frame pasa de "una escritura por región" a una.

Se evaluó una animación CSS con clases: es más barata aún, pero ata el pulso al reloj de CSS en vez de al valor de `brainwave`, que es lo que la app promete mostrar. Se descarta.

### D7. Superficie de pruebas preservada y punto de extensión para el dock

`getTimelinePlayer()` sigue devolviendo un objeto con `running`, `paused`, `index` y `remainingMs` con el mismo significado, ahora derivados del reloj de audio. Se añade un hook `onStep` en el player para que el futuro dock pueda enganchar un playhead sin volver a tocar el núcleo del player.

Se evaluó exponer un objeto `timeline` nuevo en `__CORTEX__`: rechazada porque rompería `timeline-custom-presets.cjs` sin ganancia.

### D8. Cómo se prueba el comportamiento en segundo plano

Playwright no puede simular un background real de forma fiable en los tres motores, así que la prueba se hace sobre la base temporal, que es la raíz del comportamiento:

- **Núcleo, portable:** envolver `setTimeout`/`setInterval` para retrasar artificialmente cada callback y afirmar que la progresión sigue alineada al reloj de audio, sin doble aplicación y sin deriva acumulada.
- **Catch-up:** simular varios límites vencidos y afirmar que solo se aplica el paso resultante.
- **Resync:** sobreescribir `document.hidden`/`visibilityState`, despachar `visibilitychange` y afirmar que estado, resaltado y tiempo restante reflejan la posición real.
- **Oportunista en Chromium:** `Page.setWebLifecycleState('frozen')` si está disponible, marcado como no bloqueante.

La limitación (no se reproduce el estrangulamiento real del navegador) se documenta en el reporte de pruebas en lugar de dejarlo implícito.

## Risks / Trade-offs

- **[El tick se retrasa más de lo previsto en throttling intensivo]** → El catch-up es idempotente y basado en el reloj de audio, así que un retraso grande produce un salto tardío pero correcto; la UI se resincroniza al volver. Se acepta el trade-off frente a la vía de automatización compilada (D1b).
- **`ctx.currentTime` no avanza con el contexto suspendido** → Se trata como "no reproduciendo"; el player no reporta `running` sin contexto activo.
- **[Catch-up con muchos límites vencidos podría aplicar N snapshots]** → La regla de fast-forward aplica solo el paso resultante; hay escenario de spec que lo cubre.
- **[Cifras tabulares dependen de la fuente; el fallback offline cambia métrica]** → Anchos en `ch` en lugar de píxeles, y el valor más ancho (portadora hasta 1500 Hz) se verifica en el smoke visual.
- **[Los cambios tipográficos alteran píxeles de los snapshots]** → Los PNG de `artifacts/visual/` están en `.gitignore`; se regeneran y se deja constancia de qué se considera estable en el reporte de pruebas.
- **[El tick de catch-up añade trabajo en segundo plano]** → Intervalo corto y trabajo O(1) por tick; desuscribirse al detenerse para no dejar temporizadores vivos.

## Migration Plan

No hay migración de datos: `cortex-timeline-v1` conserva su forma y los pasos siguen guardando `durationSeconds` en segundos. El cambio es un reemplazo dentro de un archivo, sin build. Rollback = restituir `cortex.html` y, si aplica, descartar los reportes de prueba generados.

## Open Questions

- Si en el futuro una sesión necesita scheduling a precisión de muestra (por ejemplo cues de TMR alineados a eventos de sueño), la vía sería el modo de automatización compilada (D1b). El diseño mantiene el reloj de audio detrás de una abstracción, así que ese cambio no obliga a rehacer el player.
- El futuro dock necesitará un hook de playhead y probablemente edición de duración por clip; el hook `onStep` de D7 existe para eso, pero el contrato definitivo se cerrará en el cambio del dock.
