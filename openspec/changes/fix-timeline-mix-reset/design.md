# Design

## Context

Flujo del bug (ver `proposal.md`): preset builtin → snapshot con `mix: 0`, `carrier: 0` → `applyAudioState` → `masterGain` 0 → el stop suave "restaura" 0. El player ya está sobre el reloj de audio y es correcto; el problema está en **qué datos le llegan**, no en su temporización.

## Goals / Non-Goals

**Goals:** que reproducir, pausar, detener y reanudar el timeline nunca deje silencio ni portadora a 0; que los datos viejos ya guardados no rompan la sesión; que se pueda probar en CI.

**Non-Goals:** rediseñar el timeline o la UI (va en `cortex-desktop-ux-redesign`); cambiar el formato persistido; tocar la lógica de planificación por reloj de audio.

## Decisions

### D1. `mix` es del usuario, no del paso
Alternativas: **(a)** completar los builtin con `carrier: 200, mix: 80` fijos — arregla el síntoma pero un paso seguiría pisando el volumen que el usuario ajustó y los presets custom (que capturan `mix`) seguirían moviéndolo; **(b)** el paso no aplica `mix` (elegida): el volumen de salida es una perilla de sesión, como en cualquier reproductor. Costo: un preset custom ya no "recuerda" su volumen al reproducirse en el timeline. Se acepta; sigue guardándose por compatibilidad.
*Pregunta abierta de producto:* si se quiere un volumen por paso en el futuro, sería un campo explícito y opcional, no `mix` mezclado en `AUDIO_KEYS`.

### D2. Claves ausentes se conservan, no se ponen en 0
`snapshotForBuiltin` solo emite las claves que el builtin define (`brainwave` + `PRESET_DEFAULTS`). `carrier` se conserva del estado vivo al aplicar. Se descarta el patrón `{ ...audioSnapshot(), ... }` como relleno.

### D3. Saneamiento al leer, no migración destructiva
Los timelines guardados con `carrier: 0` / `mix: 0` se **interpretan** de forma segura al leer (rango válido de carrier 20–1500; `mix` ignorado en pasos) en vez de reescribirse. Alternativa descartada: migración que reescribe `localStorage` — irreversible y innecesaria si D1 hace que el `mix` guardado sea inerte.

### D4. El stop suave restaura el mix del usuario, capturado antes
Se captura el `mix` "del usuario" al iniciar el timeline o el fade y es ese el que se restaura. Evita que un valor intermedio de una rampa quede como definitivo.

### D5. Endurecimiento acotado (secundario)
Anclar rampas del motor (`cancelScheduledValues` + `setValueAtTime(valor actual)` antes de `linearRampToValueAtTime`) y dar al stop suave un respaldo por temporizador cuando `requestAnimationFrame` no corre. Se hace **después** de D1–D4 y con su propio test; si CI muestra que no aporta, se retira sin afectar el arreglo principal.

## Risks / Trade-offs

- **Certeza:** la causa D1 sale de lectura de código, no de una reproducción en navegador. La primera tarea es un test que falle en CI con el código actual; si pasa, la hipótesis es incorrecta y se reabre la investigación antes de arreglar nada.
- **Silencio legítimo:** un `mix` de 0 puesto a mano por el usuario debe respetarse; el arreglo no puede "forzar" volumen.

## Open Questions
- ¿El bug aparece con presets builtin, custom o ambos? (Los custom heredan el `mix` del momento de crearlos.)
- ¿El volumen cae durante la reproducción, al detener, o ambos?
