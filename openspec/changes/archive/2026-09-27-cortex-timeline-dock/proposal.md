# Proposal

## Why

El timeline vive en un `<dialog>` modal que cubre la app entera. El usuario lo pidió explícitamente desde el inicio del proyecto: *"me gustaría que sea más como la ui de los editores de video o editores de música porque el popup oculta la ventana y la hace ver de una forma que no me agrada en ux"*. Un secuenciador no es un evento modal: es una herramienta de acompañamiento que conviene ver mientras suena.

Además, las tarjetas actuales son todas iguales (112 px fijos): no comunican cuánto dura cada paso ni dónde va la reproducción. En un editor, el ancho del clip ES el tiempo y el playhead ES la posición — esa es la convención que el usuario pide.

Este cambio reemplaza el popup por un dock inferior permanente, plegable, con clips proporcionales a su duración y un playhead que avanza sobre el reloj de audio ya migrado.

## What Changes

- El `<dialog id="timelineDialog">` desaparece: el timeline pasa a ser un **dock inferior** siempre presente, con dos estados: **plegado** (transporte + barra de progreso fina, ~48 px) y **desplegado** (transporte + inspector + regla + pista de clips + tira de presets, ~170 px).
- El botón `⌁ Timeline` deja de abrir un modal: ahora pliega/despliega el dock.
- Los pasos se renderizan como **clips horizontales proporcionales a su duración** (ajuste a la vista), con color por banda, emote, nombre y chip de duración; ancho mínimo legible.
- Un **playhead** recorre la pista en tiempo real siguiendo el reloj de audio del player; en loop, vuelve a arrancar. Al volver de segundo plano se resincroniza.
- Click en un clip lo **selecciona** y abre un inspector con nombre, editor de duración con unidades s/min, aplicar, mover, duplicar y eliminar. Doble click aplica el preset.
- **Arrastrar** un clip lo reordena; **arrastrar su borde derecho** cambia su duración con ajuste (snap). Los botones de mover y el editor de duración del inspector son el reemplazo accesible por teclado de ambos gestos.
- El transporte (reproducir, pausar, detener, limpiar, loop, transición suave con su duración y unidad) se muda al toolbar del dock.
- Los controles de transición y unidades mantienen su comportamiento y persistencia ya especificados (`timeline-transitions`); solo cambian de lugar.
- La preferencia plegado/desplegado se persiste. No hay cambios **BREAKING** en el formato de `cortex-timeline-v1`.

## Capabilities

### New Capabilities
- `timeline-dock`: el timeline como dock inferior permanente y plegable con clips proporcionales, playhead sobre el reloj de audio, selección con inspector, gestos de reordenar y redimensionar con reemplazo accesible, y transporte integrado.

### Modified Capabilities
- Ninguna archivada. Este cambio **reemplaza la UI modal** descrita en el delta en vuelo de `timeline-custom-presets` (que exige popup accesible con Escape y foco). Ese delta se actualiza como parte de este cambio — tarea explícita — para que los dos cambios no queden describiendo UIs contradictorias al archivarse.

## Impact

- `cortex.html`:
  - HTML: se elimina `timelineDialog` y su estructura; nuevo dock entre el grid principal y la barra de estado; `#btnOpenTimeline` se rewirea.
  - CSS: dock, clips, playhead, regla, inspector, estados plegado/desplegado, responsive; se retiran los estilos del modal de timeline.
  - JS: `renderTimeline()` se divide en render de dock/transporte (estable) y render de clips (por cambio de pasos); nuevo módulo de playhead (rAF, solo `transform`); selección e inspector; gestos con Pointer Events (`pointerdown/move/up` con `setPointerCapture`); `onStep` del player ya expone lo necesario.
  - Altura: presupuesto verificable en 1366×768 (pantalla del usuario) y en el breakpoint responsive <900 px.
- Pruebas: `tests/timeline-custom-presets.cjs` actualiza sus interacciones de modal a dock; nuevo `tests/timeline-dock.cjs` (proporcionalidad, playhead, selección, inspector, gestos y sus fallbacks, plegado/desplegado); `cortex.spec.html` actualiza los casos atados al popup; `.github/workflows/ci.yml` añade el test.
- Accesibilidad: sin modal no hay trampa de foco; los gestos tienen reemplazo por teclado; los controles conservan sus etiquetas.
- Sin dependencias nuevas; el HTML sigue autónomo.
