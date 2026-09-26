# Proposal

## Why

El usuario mantiene una evolución paralela de Cortex (`Documentos/cortex.html`, 7 horas posterior a la versión del repositorio) con dos capacidades que nunca llegaron al repo:

1. **Transiciones suaves entre pasos del timeline.** Hoy cada cambio de preset es un corte seco: los ocho parámetros de audio saltan de golpe. Con sesiones de 40 minutos encadenadas, ese corte es una interrupción audible y desagradable, y la libreta de fuentes del usuario (protocolos de inducción progresiva, como la rampa Alfa→Delta del plan de sesiones guiadas) pide exactamente lo contrario: llegar a cada estado por grados.
2. **Edición de duraciones en segundos o minutos.** Con pasos de 20–45 minutos, teclear "1800" en un campo de segundos es frágil y propicio a errores de un cero.

Este cambio recupera ambas capacidades y las adapta al motor actual. No se copia el archivo: su reproductor usa `requestAnimationFrame` y `performance.now()`, que no se ejecutan nada con la pestaña oculta, de modo que portearlo tal cual reintroduciría —en peor— el defecto de transiciones pausadas que el cambio `cortex-timing-and-ui-stability` acaba de corregir. Las features se portan sobre el reproductor de reloj de audio. Tampoco se migra el script de Cloudflare que el archivo arrastra al final, que es un resto de su descarga y no forma parte de la app.

## What Changes

- Nuevo estado de transición global en el timeline: `{ enabled, seconds }`, con "Transición suave" activada por defecto a 2 s, límite 0–60 s, y persistencia en `cortex-timeline-v1` con valores por omisión para datos previos.
- Al iniciar un paso, el reproductor captura el estado de audio actual y el del preset, e interpola los ocho parámetros durante la transición usando el tick de reloj de audio que ya existe; con transición desactivada o de 0 s se conserva el corte directo actual.
- El estado del texto de estado añade "· transición" mientras dura la rampa.
- Editar la duración o el interruptor de transición durante la reproducción reprograma la rampa en vivo, sin reiniciar el paso.
- Las duraciones de paso y de transición se editan en segundos o minutos, con un conmutador de unidad por contexto, límites por tipo (pasos 1–3600 s; transición 0–60 s), conversión y una pista del equivalente en la otra unidad.
- La aplicación interpolada pasa por el planificador de frame (coalescing y dirty check de `ui-stability`): los sliders y readouts se deslizan visiblemente durante la rampa, pero sin una pasada de DOM por tick.
- Los presets personalizados y los pasos existentes no cambian de formato: solo se añaden campos con valores por omisión. No hay cambios **BREAKING**.

## Capabilities

### New Capabilities
- `timeline-transitions`: transición suave e interpolada entre pasos del timeline sobre el reloj de audio, con edición en vivo de la configuración y con unidades de duración (s/min) para pasos y transición.

### Modified Capabilities
- Ninguna. La capability de UI del timeline sigue en vuelo en `timeline-custom-presets`; este cambio añade controles a su toolbar sin alterar sus requisitos ya especificados.

## Impact

- `cortex.html`:
  - `timelineState` (~721): nuevo campo `transition` y `durationUnits`; `loadTimelineData()` y `persistTimeline()` amplían el esquema con valores por omisión.
  - Funciones nuevas junto al player: `AUDIO_KEYS`, `interpolateAudioState`, `applyAudioState` (variante sin toast), y la familia de unidades (`normalizeDurationUnit`, `durationLimits`, `clampDurationSeconds`, `durationToSeconds`, `secondsToDuration`, `durationInputConfig`, `durationHint`, `clampTransitionSeconds`, `setDurationUnit`, `renderDurationUnitButtons`).
  - `TimelinePlayer`: `startStep` captura estados origen/destino; el tick interpola; `pause`/`reschedule` conservan el progreso de la rampa; nuevo `refreshTransition()`.
  - HTML del toolbar del timeline: checkbox, editor de duración de transición y conmutadores de unidad; `renderTimeline()` con editores de duración por paso.
  - CSS: `.transition-control`, `.duration-editor`, `.duration-unit-toggle`, `.duration-unit-option`, `.duration-hint`.
- Pruebas: `tests/timeline-scheduling.cjs` hereda los casos que dependen de `applyAudioSnapshot`; se añade `tests/timeline-transitions.cjs` y se actualiza el runner in-page donde el corte directo pase a ser rampa.
- La verificación de la interpolación exige reloj de audio corriendo: en CI cubre Chromium y WebKit; en Firefox headless queda documentado como omitido, igual que en `cortex-stability-report.md`.
