# Tasks

## 1. Presets personalizados: aplicar en el mismo tick (D1)

- [x] 1.1 Flush síncrono al aplicar un preset custom: `applyAudioSnapshot` (o su caller en `cortex-custom-presets.js`) aplica `syncUIFromState()` y los updates del motor en el mismo tick del click, sin esperar al rAF; el coalescing de `markUiDirty` se conserva para rampas y stop suave. Verificar: unitario nuevo o caso en `mix-integrity.cjs` — tras aplicar un preset custom, sliders/readouts simulados muestran los valores del preset en el mismo tick y el motor recibió esos valores.
- [x] 1.2 Guardar un preset mientras suena captura los parámetros actuales: al guardar con audio reproduciendo, `audioSnapshot()` del estado vivo queda en `state` del preset (brainwave/carrier incluidos) y al re-aplicar restaura esos valores. Verificar: unitario con estado vivo 7.5 Hz/432 Hz → guardar → aplicar → estado y sliders en 7.5/432.

## 2. Pausa real del transporte (D2)

- [x] 2.1 `togglePause()` en `cortex-playback.js`: con reproducción activa, congela el audio (`ctx.suspend()` vía el motor), pausa el player del timeline si corre, y lleva el transporte a un estado `paused` visible («pausado» en el footer, botón ofreciendo reanudar); sin reproducción activa es no-op honesto. Verificar: unitario con motor simulado — pausa cambia el status a pausado, `suspend` fue llamado, y el audio no queda «reproduciendo».
- [x] 2.2 Reanudar restaura la posición exacta: `resume` reactiva el audio (`ctx.resume()`), reanuda el player por sus restantes congelados (ya implementado en `pause()`/`play()` del player) y vuelve a «reproduciendo» sin deriva del reloj de audio. Verificar: unitario estilo `timeline-logic.cjs` — pausa a mitad de rampa, avanza el reloj simulado en pausa, reanuda: restante de paso y de rampa idénticos a los congelados; converge al destino.
- [x] 2.3 Conectar las dos superficies al mismo contrato: el atajo `P` (`cortex-app-events.js` bindKeyboardShortcuts) y el botón `Ⅱ Pausar` del dock llaman ambos a `togglePause` (el botón deja de llamar solo a `player.pause()`); el header muestra reanudar durante pausa. Verificar: `keyboard-shortcuts.cjs` actualizado pasa (P → togglePause, guardas intactas) y unitario del botón pausa → mismo estado visible que el atajo.

## 3. Mapa cerebral coherente al detener (D3)

- [x] 3.1 Al completar el stop (suave o directo), retirar `active`/`teal-active` de las regiones del SVG del mapa cerebral, en paridad con el radar; el panel de texto (banda/descripción) conserva la última sesión. Verificar: unitario con DOM simulado — tras `finishGentleStop`/stop, cero regiones con clase `active` y el texto de banda sigue legible.

## 4. Docs de la sesión externa y verificación

- [x] 4.1 Actualizar `tests/manual/cortex-ui-prd.md`: los hallazgos de entorno quedan como «bloqueado con causa esperada» (PiP `about:blank` inherente a la API, foco `:focus-visible` sintético por CDP, action budget del harness) y B4/B1 se reescriben con el contrato de pausa nuevo (P pausa audio+secuencia, footer «pausado»). Verificar: el PRD no pide a la próxima corrida nada que el entorno no pueda dar.
- [ ] 4.2 Push a `main` y leer la corrida de CI completa: ambos jobs en verde, artifacts revisados (light-verify con 0 fallos, math `failures: []`), y la build desplegada. Verificar: el veredicto es la corrida.
- [ ] 4.3 Re-ejecutar la sesión externa de UI con el PRD actualizado y registrar los resultados por título: los de app (pausa, presets, Space, brackets, mapa) en verde; los de entorno como blocked con su causa. Verificar: cada título con veredicto explícito; sin presentar la sesión como cobertura permanente.
