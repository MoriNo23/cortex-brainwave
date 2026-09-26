# Tasks

## 1. Estado y funciones puras

- [x] 1.1 Añadir `AUDIO_KEYS` y el estado de transición (`timelineState.transition = { enabled: true, seconds: 2 }`, `durationUnits = { step: 's', transition: 's' }`), y verificar con el cargador que datos previos sin esos campos cargan con los valores por omisión.
- [x] 1.2 Portear `interpolateAudioState(from, to, progress)` y verificar con una evaluación directa que el progreso 0 devuelve el origen, el 1 el destino y el 0.5 la media exacta de los ocho parámetros.
- [x] 1.3 Portear la familia de unidades (`normalizeDurationUnit`, `durationLimits`, `clampDurationSeconds`, `durationToSeconds`, `secondsToDuration`, `durationInputConfig`, `durationHint`, `clampTransitionSeconds`) y verificar por evaluación que 2 min → 120 s, 90 s → 1.5 min, y que los límites restringen (paso 1–3600, transición 0–60).

## 2. Persistencia

- [x] 2.1 Extender `persistTimeline()` y `loadTimelineData()` con `transition` y `durationUnits`, con valores por omisión y recorte al rango, y verificar recargando la app que la configuración sobrevive y que un JSON corrupto o vacío no rompe la carga.

## 3. Player con transiciones sobre el reloj de audio

- [x] 3.1 Añadir `applyAudioState(snapshot, { label, toast })` que actualice estado y motor y marque la UI sucia (sin toast, sin `syncUIFromState` por llamada), dejando `applyAudioSnapshot` como envoltura con toast, y verificar que un preset aplicado por la vía nueva produce el mismo estado de motor y de readouts que la vieja.
- [x] 3.2 Capturar origen/destino en `startStep` e interpolar en el tick usando `(clockNow() - stepStartedAt)`, con corte directo cuando la transición está desactivada o en 0 s, y verificar con una sesión con rampa que el estado final del paso es exactamente el del preset y que el status muestra "· transición" durante la rampa.
- [x] 3.3 Hacer que `pause()`/reanudación conserven el progreso de la rampa (sin relojes paralelos: `stepStartedAt` es la base de ambos) y verificar pausando a mitad de rampa que al reanudar la rampa llega al destino dentro de la duración configurada.
- [x] 3.4 Implementar `refreshTransition()` para editar interruptor y duración en vivo sin reiniciar el paso, y verificar cambiando la duración a mitad de rampa que el paso conserva su fin programado y que desactivar aplica el preset directo.
- [x] 3.5 Extender el hook `onStep` con `source`, `target` y `transitionMs`, y verificar que el dock futuro podrá leer el progreso sin tocar el player.

## 4. UI de transiciones y unidades

- [x] 4.1 Añadir al toolbar del timeline el interruptor "Transición suave", el editor de duración con conmutador s/min y la pista de equivalencia, con el CSS correspondiente, y verificar que los controles muestran el estado persistido y que sobreviven a cerrar/abrir el popup.
- [x] 4.2 Añadir a cada paso el editor de duración con conmutador de unidad y pista, reemplazando el input actual, y verificar que cambiar de unidad convierte el valor mostrado sin alterar los segundos guardados.
- [x] 4.3 Implementar `setDurationUnit(context, unit)` y `renderDurationUnitButtons(context)` y verificar que el conmutador afecta solo a su contexto (pasos o transición) y que la pista muestra el equivalente correcto.
- [x] 4.4 Enlazar los eventos de los controles nuevos (interruptor, duración de transición, botones de unidad) con `refreshTransition()`/`reschedule()` según corresponda, y verificar que editar durante la reproducción no reinicia el paso.

## 5. Pruebas

- [x] 5.1 Fijar transición desactivada en el `SETUP` de `tests/timeline-scheduling.cjs` para que siga midiendo límites de paso puros, y verificar que la suite existente pasa sin cambios de aserciones.
- [x] 5.2 Crear `tests/timeline-transitions.cjs` con: rampa completa entre dos presets (estado final exacto y valores intermedios distintos de ambos extremos), corte directo con transición desactivada, edición de duración a mitad de rampa, reanudación a mitad de rampa, unidades (2 min → 120 s) y persistencia de la configuración.
- [x] 5.3 Añadir al runner in-page (`cortex.spec.html`) los casos de interpolación y de unidades, y verificar que la suite completa pasa.
- [x] 5.4 Correr la CI completa (suite Chromium, tres motores, matriz) y registrar los conteos por motor en el reporte; documentar que en Firefox headless los escenarios de rampa se omiten por el reloj de audio suspendido, como ya se hace hoy.

## 6. Cierre

- [x] 6.1 Documentar en el glosario la transición suave (qué interpola, límite 0–60 s, qué significa el "· transición" del status) sin convertirla en afirmación médica.
- [x] 6.2 Actualizar `cortex-stability-report.md` (o crear el reporte del cambio) con la evidencia de la CI y el trade-off de la rampa bajo estrangulamiento intensivo.
- [x] 6.3 Validar con `openspec validate cortex-timeline-transitions --strict --json` y dejar el resultado anotado.
- [x] 6.4 Escucha humana: sesión con una rampa de 10 s entre Theta y Alpha con la ventana minimizada, y anotar si la interpolación del volumen (`mix`) resulta cómoda o conviene excluirla. (Confirmado por el usuario: la transición se escucha continua, las unidades en minutos funcionan y la rampa progresa sin foco en la app. `mix` se mantiene interpolado.)
