# Design

## Context

Sesión externa de UI (TestSprite) contra la build publicada; hallazgos
clasificados contra el código real en explore. Estado actual relevante:

- **Presets**: dos caminos divergen. Builtin (`cortex-presets.js:applyPreset`)
  escribe sliders sincrónicamente (`syncUIFromState`). Custom
  (`cortex-custom-presets.js` → `applyAudioSnapshot` → `applyAudioState`)
  actualiza `state` y difiere el DOM con `markUiDirty('controls')` al próximo
  rAF (`cortex-ui-shell.js` coalescing pensado para rampas del timeline que
  reescriben sliders 60 veces por segundo). Un click de preset custom NO está
  en ese caso de rampa: es una acción puntual.
- **Pausa**: el player del timeline ya tiene `pause()`/`play()` correctos
  (congela restante de paso y de rampa — cubierto en `timeline-logic.cjs`),
  pero el AUDIO sigue sonando: nadie llama a `AudioContext.suspend()`. El
  botón `Ⅱ Pausar` y el atajo `P` solo tocaban el player y eran no-op sin
  timeline corriendo, con el footer en «reproduciendo».
- **Regiones del mapa**: `applyBandInfo` nunca se apaga al detener; el radar
  (canvas) sí chequea `state.playing`. El stop suave termina en
  `setPlaybackUi('stopped')` sin tocar la iluminación del SVG.
- El bug del arranque muerto (`setPlaybackUi` shorthand) ya está fixeado y
  desplegado; `tests/manual/boot-repro.cjs` queda como repro del arranque.

## Goals / Non-Goals

**Goals:**
- Contrato único de aplicación de presets (mismo tick para estado+DOM+motor).
- Pausa real del transporte con estado visible y reanudación sin deriva.
- Mapa cerebral coherente con el estado del transporte al detener.
- Todo el contrato nuevo cubierto por unitarios con motor simulado.

**Non-Goals:**
- Cambiar el motor de audio, el formato de presets guardado o el de
  persistencia (`cortex-custom-presets-v1` se lee igual que hoy).
- «Arreglar» hallazgos del entorno de la sesión externa: PiP `about:blank`
  (inherente a la API), foco `:focus-visible` sintético por CDP, action
  budget del harness. Se documentan en el PRD, no se tocan.
- Pausa del estrobo, export WAV ni visuales de radar (ya coherentes).

## Decisions

### D1 — Preset custom: flush síncrono, no quitar el coalescing

`applyAudioSnapshot` gana una opción `{ flush: true }` (o el caller pasa
directo): tras `Object.assign(state)` llama `syncUIFromState()` + updates del
motor en el mismo tick — exactamente lo que ya hace `applyPreset` builtin.
El coalescing por rAF NO se elimina: sigue siendo correcto para las rampas
del timeline (`applyTransitionProgress` por tick, 60×/s) y para el stop
suave. Solo el click de preset (acción puntual del usuario) bypassa el frame.

Alternativa descartada: esperar al rAF siempre y «fixear» el harness — el
contrato de un click debe ser determinista sin depender del scheduler; el
propio TestSprite demostró que leer el DOM en el mismo tick es una expectativa
legítima de cualquier cliente.

### D2 — Pausa: un solo estado, dos superficies

El estado de pausa vive en `state.playing`/`state.paused` del transporte
central (`cortex-playback.js`), no en el player del timeline:

```
P / Ⅱ Pausar ──> togglePause()
                   ├─ ctx.suspend()          (audio congelado, no destruido)
                   ├─ timelinePlayer.pause() (si corre: congela restantes)
                   └─ setPlaybackUi('paused') (footer «pausado», botón ▶ Reanudar)
Reanudar ──────> ctx.resume() + player.play() + setPlaybackUi('playing')
```

- `ctx.suspend()`/`resume()` son del propio AudioContext: el reloj
  (`currentTime`) se congela con él → la reanudación del timeline no derrapa
  porque `boundaryAt`/`transitionStartedAt` están en tiempo de audio.
- El botón `Ⅱ Pausar` y el atajo `P` llaman al MISMO `togglePause`.
- `Space` queda iniciar/detener (stop suave); no se sobrecarga.
- Sin timeline corriendo: pausa igual el audio (deja de ser no-op).
- `setPlaybackUi` gana modo `'paused'` junto a playing/stopping/stopped.

Alternativa descartada: pausar solo el player y dejar el audio — es el
comportamiento que la sesión marcó como defecto; «pausa» que sigue sonando
no es pausa.

### D3 — Regiones: apagar iluminación, conservar banda legible

`finishGentleStop` (y el stop directo) llaman a un apagado de regiones —
retirar `active`/`teal-active` de los nodos SVG. El panel de texto (bandName,
bandDesc) NO se toca: queda como memoria de la última sesión, igual que el
status bar conserva la banda. Paridad exacta con el radar, que ya apaga el
campo dinámico con `playing = false`.

Alternativa descartada: dejarlo como «última banda visible» — la sesión
externa lo leyó como inconsistencia y el radar ya fija el precedente de
apagarse; la memoria textual es suficiente.

### D4 — Unitarios primero, sin navegador

Tres frentes de test, patrón existente:
1. `keyboard-shortcuts.cjs`: `P` pasa de «click en botón pause» a «llama
   togglePause» — el test de guardas no cambia (17/17 siguen).
2. Nuevo `transport-pause.cjs` (o extensión de `timeline-logic.cjs`):
   motor con `suspend/resume` simulados + reloj congelado: pausa a mitad de
   rampa → restantes congelados → reanudar → converge; status «pausado».
3. `mix-integrity.cjs` gana un caso: preset custom aplica y flush-ea en el
   mismo tick (slider y engine reciben los valores del preset, no rAF).
La sesión de navegador solo re-verifica lo ya cubierto; no se añade job.

## Risks / Trade-offs

- [`ctx.suspend()` congelado demasiado: el estrobo usa `performance.now()`,
  no el reloj de audio] → El estrobo sigue parpadeando en pausa con la
  pestaña visible; aceptable (es luz, no audio). Si molesta, la pausa del
  estrobo es un cambio aparte.
- [Preset custom con flush rompe la rampa del timeline si un paso aplica
  mientras corre] → El timeline usa `applyAudioState(..., { preserve })`
  (camino rampa), no `applyAudioSnapshot` (camino click): no comparten el
  flush. Unitarios existentes del timeline lo guardan.
- [`state.paused` nuevo vs. solo `playing=false`] → Se introduce explícito
  para que «detenido» y «pausado» no colapsen en el footer; `setPlaybackUi`
  ya es el único escritor del texto de estado.
- [Boot-repro manual puede quedarse desactualizado] → Es repro puntual, no
  suite; si cambia el DOM se ajusta al usarlo.

## Migration Plan

1. Implementar D1 (presets) → CI verde → desplegar.
2. D2 (pausa) + D3 (regiones) en el mismo push → CI verde → desplegar.
3. Re-ejecutar la sesión externa con el PRD actualizado; confirmar que los
   títulos que eran bugs de app pasan y los de entorno quedan «blocked con
   causa» (no «fail»).

Rollback: cada frente es un commit independiente; revert restaura el
comportamiento anterior sin migración de datos (el formato de presets no
cambia).

## Open Questions

- ¿El botón del header `▶ Iniciar` durante pausa muestra «▶ Reanudar» o
  mantiene «Iniciar»? (Detalle de copy; no cambia el contrato. Default
  propuesto: «▶ Reanudar» mientras `paused`.)
