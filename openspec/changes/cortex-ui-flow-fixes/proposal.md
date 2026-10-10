# Proposal

## Why

Una sesión externa de pruebas de UI (TestSprite contra la build publicada)
sacó a la luz problemas de flujo de usuario reales: los presets personalizados
no actualizan los controles de forma verificable al aplicarlos, el mapa
cerebral queda con regiones activas tras detener (inconsistente con el radar,
que sí se apaga), y el atajo de pausa y su botón no comunican qué pausan
realmente — hoy «pausa» solo pausa el secuenciador y el footer sigue diciendo
«reproduciendo», lo que cualquier persona (o harness) lee como un fallo.
Estos son defectos de contrato de la UI que CI no cubre porque CI no usa
navegador: hay que fijarlos en spec y portarlos a unitarios.

## What Changes

1. **Aplicar un preset personalizado actualiza los controles de forma
   síncrona y verificable.** El camino custom (`applyAudioSnapshot`) hoy
   actualiza el estado pero difiere la escritura de sliders al próximo
   `requestAnimationFrame` (coalescing pensado para rampas del timeline), a
   diferencia del camino builtin que escribe el DOM en el mismo tick. El
   click sobre un preset custom queda sujeto al mismo contrato que el
   builtin: estado, sliders y readouts actualizados en el mismo tick, sin
   depender del frame siguiente.
2. **El transporte de audio tiene pausa real.** `P` y el botón `Ⅱ Pausar`
   pausan TODO el audio (`AudioContext.suspend()` + congelar el reloj del
   timeline), el footer muestra «pausado», y reanudar restaura la posición
   exacta (restante del paso y de la rampa). Sin timeline en reproducción,
   la pausa aplica igual al audio individual. **BREAKING** para quien
   esperara que `P` solo ignore el player del timeline: el comportamiento
   pasa a ser «pausa el sonido y la secuencia».
3. **Al detener, el mapa cerebral vuelve al estado inactivo.** Las clases
   `active`/`teal-active` de las regiones SVG se retiran cuando el
   transporte queda detenido, en paridad con el radar (canvas), que ya lo
   hace. La banda sigue visible en el panel de texto como memoria de la
   última sesión; lo que se apaga es la iluminación del mapa.
4. **La pausa es verificable en unitarios.** El contrato nuevo (estado
   «pausado» visible, reloj congelado, reanudación sin deriva) queda
   cubierto por unitarios con motor simulado, extendiendo el patrón de
   `mix-integrity.cjs`/`timeline-logic.cjs`. Los atajos de teclado (`P`,
   Space, `[`, `]`, `T`) se re-verifican contra el contrato nuevo.

Fuera de alcance (documentado, no se cambia): los hallazgos de la sesión que
son artefactos del entorno — la ventana Document PiP siempre es `about:blank`
(es inherente a la API; el panel se muda a su DOM), el «action budget» del
harness, y el foco `:focus-visible` sintético por CDP. Se actualiza el PRD de
la sesión de UI (`tests/manual/cortex-ui-prd.md`) para que una próxima corrida
externa no vuelva a reportarlos como fallos.

## Capabilities

### New Capabilities

- `transport-pause`: la pausa real del transporte — audio y secuencia
  congelados, estado visible «pausado», reanudación sin deriva, atajo y
  botón con el mismo contrato.

### Modified Capabilities

- `cortex-testing`: el requisito de límites del test gana un escenario: la
  pausa del transporte queda cubierta por unitarios con motor simulado
  (hoy ese comportamiento no está cubierto en ninguna spec).
- `desktop-workspace-ux`: el escenario de atajos se precisa — `P` pausa el
  transporte completo (no solo el timeline) y el estado resultante es
  visible en el footer; y el mapa cerebral apagado al detener entra como
  escenario del requisito de estados de interacción/visibilidad.

## Impact

- **Código**: `cortex-custom-presets.js` (aplicación síncrona), nueva
  pausa en `cortex-playback.js` + `cortex-audio-engine.js`
  (`ctx.suspend/resume`), `cortex-timeline-player.js` (pausa ya existe:
  reutilizar y conectar), `cortex-app-events.js` (atajo `P` al nuevo
  contrato), apagado de regiones en el ciclo stop
  (`cortex-ui-shell.js`/`applyBandInfo`).
- **Unitarios**: extender `keyboard-shortcuts.cjs` (P → contrato nuevo),
  nuevo o extendido test de pausa del transporte (estado + reloj + UI),
  test de presets custom aplicando controles en el mismo tick.
- **Docs**: `tests/manual/cortex-ui-prd.md` actualizado con los límites del
  entorno (PiP `about:blank`, foco CDP, presupuesto de acciones del harness).
- **Sin cambio**: motor de audio (solo `suspend/resume` que ya expone el
  AudioContext), verificación por CI, el protocolo de escucha humana.
