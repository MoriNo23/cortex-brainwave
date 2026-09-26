# Design

## Context

- El usuario pidió el dock desde el primer mensaje; su pantalla es un panel LVDS de **1366×768**, así que el alto es el recurso escaso. El layout actual: header 52 px + grid (panel izq. | zona cerebral | panel der.) + status bar ~28 px.
- El player ya existe sobre el reloj de audio: `stepStartedAt`, `boundaryAt`, `remainingMs` vivo, `onStep(index, step, durationMs, {source, target, transitionMs})`, resync en `visibilitychange`, rampas y unidades s/min ya implementadas y persistidas.
- `renderTimeline()` reconstruye hoy todo el DOM de pasos y el picker en cada cambio; el botón `#btnOpenTimeline` abre el `<dialog>`; `tests/timeline-custom-presets.cjs` y casos de `cortex.spec.html` interactúan con el popup (click en `#btnOpenTimeline`, `.timeline-duration`, `#timelineLoop`, Escape).
- El delta en vuelo de `timeline-custom-presets` especifica un popup accesible (Escape, retorno de foco). Este cambio lo reemplaza; si no se ajusta, dos cambios en vuelo describirían UIs contradictorias.

## Goals / Non-Goals

**Goals:**

- Dock inferior permanente, plegable, que nunca tape la app.
- Clips proporcionales a la duración y playhead sobre el reloj de audio.
- Selección + inspector como vía de edición completa por teclado.
- Gestos de arrastre (reordenar, redimensionar) con equivalentes accesibles.
- Presupuesto de alto verificable en 1366×768 y usable <900 px.
- Las suites existentes migran sus interacciones del modal al dock.

**Non-Goals:**

- Arrastrar presets desde el panel izquierdo al track (la tira de presets dentro del dock desplegado es la entrada v1).
- Zoom temporal / regla arrastrable para hacer *seek*: la regla es informativa y el playhead es de solo lectura.
- Multitrack, undo/redo.
- Cambios en el formato de `cortex-timeline-v1` (solo se añade la preferencia del dock en ajustes).

## Decisions

### D1. Dock inferior de dos estados, no modal ni panel lateral

Alternativas: **(a)** rediseñar el modal como no-bloqueante — sigue robando espacio y compitiendo con los visualizadores; **(b)** panel lateral — en 1366 de ancho ya hay tres columnas; **(c)** dock inferior de dos estados (elegida). El dock es la convención del usuario (editores de video/audio) y el estado plegado cuesta ~48 px: a 768 px de alto, plegado deja ~700 px para el resto; desplegado ~170 px sigue dejando la zona cerebral visible. El toggle reutiliza `#btnOpenTimeline` (mantiene un ancla de las pruebas) y la preferencia se guarda con los ajustes.

### D2. Clips proporcionales con "ajuste a la vista" y ancho mínimo

El ancho de cada clip es `duración / total` del ancho de pista, con **ancho mínimo de 44 px** (tocable) y elipsis en nombre largo. Alternativas: píxeles por segundo fijos con zoom (más fiel a un DAW, pero exige resolver zoom+scroll en v1 y el caso real del usuario —sesiones de 40 min con pasos de 5–45 min— queda servido por el ajuste a la vista); scroll cronológico (mismo problema). El ajuste a la vista hace visible **toda la sesión de un vistazo**, que es justo lo que un popup de tarjetas iguales no comunicaba. El chip de duración muestra el valor exacto en la unidad vigente, así que el redondeo visual nunca miente.

### D3. Playhead: leer el player, no mantener un reloj propio

El loop de render ya existe (`renderLoop`). El playhead calcula su posición desde el player: fracción dentro del paso = `1 - remainingMs/durationMs` y desplazamiento acumulado = suma de duraciones previas / total. Se escribe **solo `transform: translateX()`** — sin layout — en un único nodo, y el tick de 60 ms del player no toca el DOM: el rAF existente es el que mueve el playhead. Oculto, rAF se congela (invisible, correcto) y el `visibilitychange` existente repinta al volver. En loop, el playhead vuelve al inicio por construcción (la fracción se recalcula desde el paso 0). Alternativa descartada: playhead animado por CSS/transitions — desincronizable del reloj de audio.

### D4. Inspector sobre selección, no inputs dentro del clip

Un clip de 44–120 px no aloja un input usable. La selección por click abre un **inspector de una línea** sobre la pista: nombre, editor de duración (reusa el componente s/min ya existente), aplicar, mover, duplicar, eliminar. Doble click aplica. Alternativas descartadas: input embebido (muy chico), menú contextual (hostil a teclado y a pantallas chicas). La selección es estado de UI transitorio; solo el dock registra preferencia.

### D5. Gestos con Pointer Events y `setPointerCapture`; snap consciente de la unidad

Arrastre: `pointerdown` en el cuerpo del clip (con umbral de 4 px para distinguir de click), `pointermove` mostrando el hueco de destino, `pointerup` consolida el orden. Redimensionado: `pointerdown` en el borde derecho (zona de 8 px, `cursor: ew-resize`), arrastre con **snap de 1 s** en segundos (o 0.5 min ≈ 30 s en minutos), límites 1–3600 s. Se descarta HTML5 drag-and-drop nativo: su modelo de imagen fantasma y eventos es errático entre motores y pésimo para el caso de precisión. Ambos gestos tienen reemplazo por teclado (botones de mover y editor del inspector), lo que además es el camino de las pruebas automatizadas.

### D6. Render dividido: transporte estable, clips efímeros

Hoy `renderTimeline()` re-escribe todo. El dock separa: **render de estructura** (toolbar, inspector, pista, regla — solo al montar y al plegar/desplegar) y **render de clips** (al cambiar pasos, selección o duraciones). El playhead nunca re-renderiza nada. Los listeners de gestos viven en la pista (delegación), no en cada clip, para que re-renderizar clips no duplique handlers.

### D7. Migración honesta de las suites atadas al modal

- `tests/timeline-custom-presets.cjs`: `#btnOpenTimeline` sigue existiendo (ahora despliega el dock); `.timeline-duration` pasa a vivir en el inspector → el test selecciona el primer clip antes de editar. Sus aserciones de orden/duplicar/eliminar se mantienen.
- `cortex.spec.html`: los casos de popup (Escape, cierre, foco) se reemplazan por casos de dock (plegar/desplegar, selección, proporcionalidad).
- El delta en vuelo de `timeline-custom-presets` se actualiza en una tarea explícita: sus requisitos de popup pasan a describir el dock, para que al archivar no queden dos UIs contradictorias.

### D8. Accesibilidad y foco sin modal

Sin `<dialog>` desaparece la trampa de foco; el Escape del modal deja de aplicar (el dock no se cierra con Escape: es parte de la interfaz). Los clips son botones con `aria-label` (nombre, banda, duración); la pista es `role="list"`; el inspector se anuncia con `role="toolbar"` y los gestos tienen `aria-describedby` apuntando al reemplazo por teclado. El foco nunca se mueve solo.

## Risks / Trade-offs

- **[El dock desplegado come ~170 px a 768 px de alto]** → Presupuesto verificado en la tarea de layout: la zona cerebral conserva su fila; si la pantalla fuera menor, el estado por omisión es plegado y la preferencia es del usuario.
- **[Clips mínimos distorsionan la proporcionalidad en sesiones muy desiguales]** → Tolerancia asumida y documentada: el chip muestra el valor exacto; la regla marca los tiempos reales.
- **[Arrastre en motores táctiles/trackpads disparos accidental]** → Umbral de 4 px y `pointercancel` que revierte; el reemplazo por teclado siempre existe.
- **[Re-render de clips pierde el drag en curso]** → El drag pausa el render de clips (bandera durante el gesto) y consolida al soltar.
- **[Dos cambios en vuelo describen el timeline]** → Tarea explícita de reconciliación del delta de `timeline-custom-presets` antes de cerrar este cambio.

## Migration Plan

Sin migración de datos: `cortex-timeline-v1` no cambia. La preferencia del dock (plegado/desplegado) se guarda en `cortex-settings`. Los usuarios del popup no pierden nada: las mismas acciones viven en el dock. Rollback = restituir `cortex.html`.

## Open Questions

- Si la escucha humana prefiere el playhead con indicador de transición (por ejemplo, un sombreado durante la rampa), se añade como detalle visual del clip activo; no cambia el contrato.
- El arrastre desde el panel izquierdo de presets queda anotado como evolución natural de v2 si el uso lo pide.
