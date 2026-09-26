# Design

## Context

- La versión paralela del usuario (`Documentos/cortex.html`) ya resuelve transiciones e unidades, pero sobre un player de `requestAnimationFrame` + `performance.now()`: rAF no se ejecuta nada con la pestaña oculta, así que portear su player reintroduciría el defecto de transiciones pausadas corregido en `cortex-timing-and-ui-stability`. Sus funciones puras (`interpolateAudioState`, familia de unidades) sí son portables casi tal cual.
- El player actual decide los límites de paso contra `ctx.currentTime` con un tick de 60 ms (`TIMELINE_TICK_MS`), idempotente, con fast-forward al volver de segundo plano, y expone `running`, `index`, `paused`, `remainingMs` que las pruebas existentes leen.
- `applyAudioSnapshot()` escribe UI completa y toast por llamada: aplicarla por tick durante una rampa sería el patrón de thrashing que `ui-stability` eliminó.
- Los tests de `timeline-scheduling.cjs` hacen pasos de 1 s y esperan cortes directos: el corte por omisión debe preservarse para no romperlos; la rampa será opt-in por configuración ya activada por omisión… por lo que los tests existentes deberán fijar transición desactivada en su setup para seguir midiendo límites puros.

## Goals / Non-Goals

**Goals:**

- Transición suave entre pasos, interpolando los ocho parámetros de audio.
- Configuración persistente y editable en vivo, sin reiniciar el paso.
- Unidades s/min para pasos y transición, con límites y conversión.
- La rampa corre sobre el reloj de audio: sobrevive pestaña oculta, pausa y reanudación.
- La UI de la rampa pasa por el planificador de frame.

**Non-Goals:**

- No se porta el player de rAF de la versión paralela; ni el script de Cloudflare que arrastra ese archivo.
- No se reemplaza el popup del timeline por el dock: es otro cambio del roadmap.
- No se añaden rampas programadas sobre `AudioParam` (automatización compilada): la interpolación va por el tick, que ya decide contra el reloj de audio.
- No cambia el formato de `cortex-timeline-v1` más allá de campos nuevos con valores por omisión.

## Decisions

### D1. Interpolación por tick del reloj de audio, no por rAF y no por automatización compilada

Al iniciar un paso con transición, el player captura `sourceState = audioSnapshot(state)` y `targetState = audioSnapshot(step.snapshot)`. Cada tick calcula el progreso como `(clockNow() - stepStartedAt) / transitionSeconds`, interpolaa y aplica. Opciones consideradas:

- **(a) Interpolar en el tick de 60 ms (elegida).** El tick ya existe, ya es idempotente y ya decide contra `ctx.currentTime`. Los `linearRampToValueAtTime(t + 0.05)` del motor convierten cada punto interpolado en un micro-ramp, así que 60 ms entre puntos encadena un glissando continuo. Sobrevive la pestaña oculta: si el tick se estrangula, el siguiente tick recalcula el progreso desde el reloj y la rampa "aterriza" en el punto correcto — el mismo argumento de no-acumulación que la progresión de pasos.
- **(b) Automatización compilada (`linearRampToValueAtTime` al valor final con la duración completa).** Precisión de muestra e inmunidad total al estrangulamiento, pero cada interacción del usuario durante la rampa exige cancelar valores agendados en los ocho parámetros, y un paso cuyo origen depende del estado vivo no se puede agendar por adelantado. Es la vía D1b ya reservada en el design anterior para precisión de muestra futura.
- **(c) rAF + `performance.now()` (la versión paralela).** Descartada por regresión: rAF no corre oculto y la rampa se congelaría justo en el caso de uso "me minimizo mientras escucha".

Consecuencia aceptada: con estrangulamiento intensivo (un tick por minuto), una rampa de 2 s puede aterrizar con un salto tardío. Es el mismo trade-off documentado para la progresión de pasos; el fast-forward de rampa es simplemente "recalcular progreso desde el reloj", que es gratis en (a).

### D2. Vía de aplicación sin toast ni escritura completa de UI

Se añade `applyAudioState(snapshot, { label, toast })` que asigna el estado, actualiza el motor (`updateBrainwave`, `updateCarrier`, `updateModLevels`) y marca la UI sucia (`markUiDirty('readouts', 'spatial', 'band')`) en vez de llamar a `syncUIFromState()` + `updateSpatialReadout()` por punto. `applyAudioSnapshot` queda como envoltura con toast. La versión paralela aplicaba la UI completa a 60 fps: es exactamente el patrón que este proyecto eliminó. Efecto visible deseado: los sliders se deslizan solos durante la rampa, con una pasada por frame.

### D3. `stepStartedAt` también es la base temporal de la rampa

El progreso de la rampa se mide contra `stepStartedAt` — el mismo campo que usa la progresión del paso. Así la pausa/reanudación y la edición de duración no necesitan relojes paralelos: `pause()` congela el paso completo (ramp incluida, porque no hay ticks) y al reanudar el progreso continúa desde el tiempo consumido. La versión paralela necesitaba `transitionElapsedMs` propio porque medía con `performance.now()`; contra el reloj de audio, `max(0, clockNow() - stepStartedAt)` ya es el tiempo transcurrido del paso y de la rampa.

### D4. Unidades: portear la familia de funciones puras, con límites por tipo

`normalizeDurationUnit`, `durationLimits` (paso 1–3600 s; transición 0–60 s), `clampDurationSeconds`, `durationToSeconds`, `secondsToDuration`, `durationInputConfig`, `durationHint` se portan tal cual de la versión paralela: son puras, pequeñas y ya probadas por el uso. `setDurationUnit(context, unit)` y `renderDurationUnitButtons(context)` gestionan el conmutador y re-renderizan el contexto afectado. La unidad se persiste por contexto (`step`, `transition`) junto a la transición.

### D5. Tests existentes: fijar transición desactivada en el setup

`timeline-scheduling.cjs` mide límites de paso con snapshots que saltan a valores conocidos; una rampa de 2 s haría que `state.brainwave` sea intermedia durante buena parte del paso de 1 s. El `SETUP` de esos escenarios fija `transition.enabled = false` para seguir midiendo progresión pura, y los nuevos tests de transición cubren la rampa por su cuenta. No es estrechar el alcance: es que cada suite mida una cosa.

### D6. Punto de extensión conservado

El hook `onStep` pasa a recibir también el estado de la rampa (`source`, `target`, `transitionMs`) para que el futuro dock pueda dibujar el playhead durante la transición sin volver a tocar el player.

## Risks / Trade-offs

- **[Rampa aterriza con salto bajo estrangulamiento intensivo]** → Mismo trade-off ya aceptado para la progresión: el retraso no se acumula y el estado final es el correcto. Documentado en el reporte.
- **[Interpolar `mix` cambia el volumen global durante la rampa]** → Es parte del preset y de la intención (la versión paralela lo hace igual); si resultara incómodo en escucha, el campo se excluye de `AUDIO_KEYS` de interpolación en un ajuste menor.
- **[Interpolar hacia `brainwave` cruza bandas y reescribe info de banda en cada cruce]** → La info de banda ya está gated por cruce (`applyBandInfo`), así que la rampa solo escribe al cruzar. Coste acotado y correcto.
- **[El número de transición 0 con el interruptor activado equivale a corte]** → Se documenta como comportamiento: `min(stepTotal, transición)` igual que la versión paralela.
- **[Esquema persistido crece]** → Solo campos nuevos con valores por omisión; el cargador existente ignora lo que no reconoce.

## Migration Plan

`cortex-timeline-v1` crece con `transition` y `durationUnits`; los datos previos cargan con 2 s activados y unidades en segundos. No hay datos que migrar ni build: el cambio es un archivo. Rollback = restituir `cortex.html`.

## Open Questions

- Si la interpolación de `mix` resulta incómoda en la escucha humana (5.3), se excluye del conjunto interpolado. Es un ajuste de una línea sobre `AUDIO_KEYS` y no cambia la spec.
- El dock podrá querer una curva de rampa no lineal (ease-in-out). El player expone el progreso crudo por `onStep`; la curva se decide en el cambio del dock si surge.
