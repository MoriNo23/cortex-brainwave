# Diseño: timeline y presets personalizados

## Estado de datos

Añadir un modelo versionado y serializable:

```js
{
  version: 1,
  id: "custom-...",
  name: "Nombre visible",
  emoji: "🌊",
  state: {
    brainwave: 10,
    carrier: 200,
    amod: 0,
    binaural: 0,
    stereo: 0,
    fmod: 0,
    noise: 0,
    mix: 80
  },
  band: "alpha"
}
```

El campo `band` se recalcula al crear o editar; no se acepta como una etiqueta libre desconectada de `brainwave`.

El timeline contiene pasos:

```js
{
  id: "step-...",
  presetId: "builtin-alpha" | "custom-...",
  durationSeconds: 30
}
```

La configuración se guarda en claves separadas y versionadas de `localStorage`, por ejemplo `cortex-custom-presets-v1` y `cortex-timeline-v1`. Datos inválidos o de versiones desconocidas se ignoran con un mensaje, sin romper la app.

## Popup de timeline

- Usar `<dialog>` si está disponible, con fallback controlado para navegadores compatibles con la app.
- El popup contiene una lista/grid de pasos.
- Cada paso muestra el cuadrado del preset, nombre, emote/banda y un input numérico de duración debajo.
- Acciones por paso: mover arriba/abajo, duplicar y eliminar.
- Selector de presets disponibles: cinco presets built-in más presets personalizados.
- Controles: `Reproducir`, `Pausar`, `Detener`, `Loop infinito`, `Limpiar` y `Cerrar`.
- Mostrar índice actual, tiempo restante aproximado y ciclo actual.
- El popup no debe iniciar audio automáticamente: reproducir requiere gesto del usuario.

## Scheduler

Crear un `TimelinePlayer` pequeño y testeable, separado de la clase `AudioEngine`:

- `load(steps)` valida duración mínima y presets existentes.
- `play({ loop })` inicia desde el paso actual o desde cero.
- `pause()` conserva paso y tiempo restante.
- `stop()` cancela timers/handles y deja el estado en reposo.
- `tick` aplica el preset con `applyPreset` y programa el siguiente paso.
- al terminar el último paso: vuelve a cero si `loop` está activo; si no, termina en estado `completed`.
- usar un único handle cancelable (`setTimeout` o un scheduler encapsulado), no un `setInterval` que pueda duplicar reproducciones.
- al aplicar un paso, actualizar UI, `state`, controles, readout y AudioEngine con rampas cortas; no crear nuevos `OscillatorNode` por cada paso.

El scheduler debe ser inyectable con reloj/timer falso para probar secuencias sin esperar minutos reales.

## Presets personalizados

- Botón `Crear preset` toma una copia inmutable del estado actual.
- Formulario: nombre requerido, selector de emote y resumen editable antes de guardar.
- Lista inicial de emotes sugeridos: `🌙`, `🌀`, `🌿`, `⚡`, `✨`, `🧘`, `🎯`, `🌊`, `🎵`, `🧠`, `☁️`, `🌌`, `😴`, `🚀`.
- Mostrar todos los emotes disponibles en una rejilla seleccionable, con estado activo accesible.
- Debajo del emote mostrar `Delta`, `Theta`, `Alpha`, `Beta` o `Gamma`, calculado por `bandFromFreq(brainwave)`.
- Los presets personalizados pueden editarse sin mutar pasos ya existentes: los pasos guardan una referencia estable o snapshot definido por la implementación, pero su comportamiento debe estar documentado y probado.
- Eliminar un preset debe advertir si aparece en el timeline y ofrecer quitar esos pasos o cancelar.

## Accesibilidad y portabilidad

- El dialog tiene título, foco inicial, foco de retorno, cierre con Escape y labels para inputs.
- No depender de fuentes, imágenes, API externa o backend para timeline/presets.
- Mantener los presets actuales y el comportamiento de la app si no se abre el popup.
- No introducir claims de terapia, HRTF o identificación fisiológica.
