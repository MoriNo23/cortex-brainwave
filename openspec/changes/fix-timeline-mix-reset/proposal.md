# Proposal

## Why

Al reproducir el timeline, el audio se apaga o queda mal y solo recargar la página lo recupera. La lectura del código (`src/lib`, sin ejecutar nada: `AGENTS.md` prohíbe verificar en local) apunta a una causa concreta y reproducible por análisis estático:

- `snapshotForBuiltin()` (`cortex-presets.js`) arma el snapshot de un preset builtin como `{ ...audioSnapshot(), brainwave, ...PRESET_DEFAULTS[band] }`.
- `audioSnapshot()` sin argumentos devuelve **todas** las claves de `AUDIO_KEYS` en 0, y `AUDIO_KEYS` incluye `mix`.
- `PRESET_DEFAULTS` solo define `amod`, `binaural`, `stereo`, `fmod` y `noise`. Por lo tanto cada paso builtin del timeline queda con **`mix: 0` y `carrier: 0`**.
- El player aplica el paso con `applyAudioState` (`Object.assign(state, snapshot)`): `state.mix` pasa a 0 y `masterGain` a 0. Con transición activa, `interpolateAudioState` baja el mix de forma gradual (el "se baja el mix" del reporte). `carrier: 0` deja los osciladores en 0 Hz.
- Al detener, `requestGentleStop` guarda `restoreMix = sourceState.mix`, que ya vale 0: el estado queda sin volumen y el audio no vuelve hasta recargar (`createAppState()` repone `mix: 80`).
- `normalizeTimelineStorage()` vuelve a pasar cada snapshot por `audioSnapshot()`, así que los timelines ya guardados en el navegador conservan `mix: 0` / `carrier: 0`.

Hay además dos fragilidades secundarias, de menor certeza: rampas `linearRampToValueAtTime` encadenadas cada 60 ms sin ancla previa, y un stop suave que depende de `requestAnimationFrame` (se pausa con la pestaña oculta).

## What Changes

- El **volumen de salida (`mix`) deja de ser parte de lo que un paso del timeline aplica**: es del usuario. Ni los pasos, ni las transiciones, ni el stop suave lo dejan en un valor que el usuario no eligió.
- Los snapshots builtin dejan de rellenar con ceros las claves que no definen (`carrier`, `mix`): esas claves se conservan del estado vivo.
- Los snapshots restaurados desde almacenamiento se **sanean**: un `carrier` fuera del rango válido (20–1500 Hz) o un `mix` heredado del bug no se aplican.
- El stop suave restaura el `mix` que el usuario tenía **antes** de empezar el timeline o el fade, no el valor intermedio.
- Endurecimiento (secundario): las rampas del motor se anclan al valor actual antes de rampear, y el stop suave termina aunque la pestaña esté oculta.
- No hay cambios **BREAKING** en los formatos `cortex-timeline-v1` ni de presets custom: se aceptan los datos viejos y se interpretan de forma segura.

## Capabilities

### New Capabilities
- `audio-mix-integrity`: el volumen de salida y la portadora del usuario sobreviven a la reproducción del timeline, a las transiciones y al stop suave; los datos persistidos defectuosos no los corrompen.

### Modified Capabilities
- Ninguna formal. `timeline-custom-presets` sigue **capturando** `mix` al crear un preset custom; este cambio solo define que el timeline no lo **aplica**.

## Impact

- `src/lib/cortex-presets.js` (`snapshotForBuiltin`, `stopTargetSnapshot`), `cortex-persistence.js` (`normalizeTimelineStorage`, `normalizeCustomPresets`), `cortex-audio-state.js` (`applyAudioState`), `cortex-playback.js` (`finishGentleStop`, `requestGentleStop`), `cortex-timeline-player.js`, `cortex-audio-engine.js` (anclaje de rampas).
- Pruebas: nuevo `tests/timeline-mix-integrity.cjs` registrado en `.github/workflows/ci.yml`; sin comando de verificación local.
- Sin dependencias nuevas.
