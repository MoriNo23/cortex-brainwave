# Cortex — reporte del dock del timeline

**Fecha:** 2026-09-27
**Cambio OpenSpec:** `cortex-timeline-dock`
**Capability:** `timeline-dock`
**Reemplaza:** el `<dialog id="timelineDialog">` (popup modal) por un dock inferior permanente y plegable.

## Resultado ejecutivo

El timeline dejó de ser un evento modal y pasó a ser una herramienta de acompañamiento: un **dock fijo abajo de la app**, plegable con el mismo botón `⌁ Timeline`, con clips proporcionales a su duración (el ancho del clip ES el tiempo), un **playhead** que sigue el reloj de audio ya migrado, selección con **inspector** y gestos de arrastrar/redimensionar con reemplazo accesible por teclado. La preferencia plegado/desplegado persiste en `cortex-settings`; el formato `cortex-timeline-v1` no cambia.

El usuario lo pidió desde el primer mensaje del proyecto: *"me gustaría que sea más como la ui de los editores de video o editores de música porque el popup oculta la ventana y la hace ver de una forma que no me agrada en ux"*.

## Qué se implementó

| Pieza | Detalle |
|---|---|
| Dock de dos estados | Plegado ~48 px (transporte + barra fina de progreso) / desplegado ~170 px (transporte + inspector + regla + pista + tira de presets). Va entre el grid principal y la barra de estado: `.app` pasa a `52px 1fr auto 44px`. |
| Transporte migrado | Reproducir, pausar, detener, limpiar, loop y controles de transición (interruptor, duración, unidad s/min) viven en el toolbar del dock, disponibles también plegado. `refreshTransition` y la persistencia no cambian. |
| Toggle persistente | `#btnOpenTimeline` pliega/despliega (`aria-expanded`, `aria-controls`); la preferencia se mezcla en `cortex-settings` sin borrar los ajustes de audio guardados. |
| Clips proporcionales | `flex-grow: duración` con piso de 44 px: ajuste a la vista sin JS de layout. Color por banda (variables `--band-*`), emote, nombre con elipsis y chip con el valor exacto en la unidad vigente. |
| Regla de tiempos | Segmentos con el mismo grow y min-width que los clips: las marcas coinciden con los límites por construcción; acumulan el tiempo en la unidad vigente. |
| Playhead | Un único nodo movido con `transform` desde el rAF existente. Posición = geometría cacheada del clip activo (una lectura de layout por cambio de paso, no por frame) + fracción derivada de `remainingMs`. Cruza, loopea y se resincroniza en `visibilitychange` por construcción: lee el player, no tiene reloj propio. |
| Selección + inspector | Click selecciona (estado por id, sobrevive reordenamientos); el inspector edita duración (reusa el componente s/min), aplica, mueve, duplica y elimina. Doble click aplica el preset. `reschedule()` reprograma el paso en curso sin piso de 1 s. |
| Gestos | Pointer Events delegados en la pista: arrastre horizontal (umbral 4 px, `setPointerCapture` al cruzarlo, hueco de destino visible, `pointercancel` que revierte) y redimensionado por el borde derecho (zona de 8 px, snap de 1 s en segundos / 30 s en minutos, límites 1–3600 s). Durante el gesto el render de clips queda pausado. |
| Accesibilidad | Pista `role="list"`, clips `role="listitem"` con botones etiquetados (nombre, banda, duración), inspector `role="toolbar"`, gestos con `aria-describedby` hacia el reemplazo por teclado. Sin modal no hay trampa de foco; el foco nunca se mueve solo. |
| Responsive | Bajo 900 px la pista scrollea horizontal dentro del dock (`.dock-track` con `overflow-x:auto`), la página no desborda. |

## Presupuesto de alto

El recurso escaso es el alto en el panel LVDS de 1366×768 del usuario. Valores concretos del CSS: toolbar `min-height:48px`; regla 12 px; clips 48 px; tira de presets ~30 px; inspector ~26 px (solo con selección). El dock desplegado con inspector abierto queda en ~180 px, dejando ~490 px para la zona cerebral, con la barra de estado y el transporte intactos. La verificación automatizada (`presupuesto de alto 1366×768` en `tests/timeline-dock.cjs`) aserta que la barra de estado y el transporte quedan visibles y que la zona cerebral conserva altura, y registra la altura exacta del dock en el artifact; la sensación final a esa resolución queda para la sesión humana (tarea 8.4).

## Verificación

Según `AGENTS.md`: no hay verificación local; el camino es push → leer los jobs → leer los artifacts.

`openspec validate cortex-timeline-dock --strict --json` → **válido, 0 issues** (74 ms). El delta reconciliado de `cortex-timeline-custom-presets` también valida estricto tras la reconciliación.

| Verificación | Dónde corre | Cómo se lee |
|---|---|---|
| Estática (sintaxis inline, autocontención, ids del DOM, forma de `TESTS`) | job `ligero` | artifact `light-verify` |
| Suite in-page: grupo nuevo `Timeline · dock` (sin modal, plegar/desplegar persistente, selección, proporcionalidad, doble click, edición) | job `suite` (`tests/run-cortex-tests.cjs`) | artifact `reportes-chromium` |
| `tests/timeline-dock.cjs` completo: 14 escenarios (persistencia del toggle, proporcionalidad y piso de 44 px, regla, inspector, doble click, arrastre, redimensionado con snap y tope, barra fina plegada, playhead avance/cruce/loop/resync, presupuesto 1366×768, ancho 390×844, accesibilidad) | job `suite` (Chromium) y job `motores` (los tres motores) | artifacts `reportes-chromium` / `reportes-<engine>` → `timeline-dock-<engine>.json` con conteos por motor |
| Suites migradas: `timeline-custom-presets.cjs` (edición vía inspector), `timeline-scheduling.cjs` (resaltado `.dock-clip.current`), `timeline-transitions.cjs` (unidades vía inspector) | jobs `suite` y `motores` | artifacts de cada suite |

Los escenarios que no exigen reloj de audio (los 10 primeros, los de layout y accesibilidad) van con `needsClock: false` y corren también en Firefox headless; los 4 de playhead en vivo se omiten ahí con mensaje explícito, como ya documenta `cortex-stability-report.md`. Los conteos exactos por motor quedan registrados en `timeline-dock-<engine>.json` de cada corrida.

## Hallazgos del proceso

1. **El click tras la captura del puntero cambia de destino.** Con `setPointerCapture` activo, los eventos compatibles (incluido `click`) se redirigen al elemento capturado, y `closest('[data-clip-index]')` desde el contenedor del clip no encuentra el botón. La captura se activa solo al cruzar el umbral de 4 px y los handlers de click/doble click resuelven el botón desde el clip contenedor, no desde el objetivo del evento.
2. **El tope de 3600 s no se alcanza arrastrando desde geometría chica.** La escala del redimensionado es `duración/ancho` del propio clip: desde un clip de 10 s (~200 px) un arrastre realista nunca cruza 3600 s. El caso de tope usa dos clips de 3000 s, donde +200 px sí lo cruza — y sin mover el puntero fuera del viewport, para que el gesto sea válido en los tres motores.
3. **El target del arrastre se cuenta en el espacio "sin el clip arrastrado".** Insertar en la posición propia es no-op (`target === index`); el error natural (`target === index + 1` también es no-op) manda un clip al final cuando se lo suelta al final y no lo mueve. Los tests de arrastre y de reemplazo por teclado convergen en el mismo orden desde ese espacio común.
4. **La barra de estado no se toca.** El presupuesto del design la describe como ~28 px, pero el grid la declara a 44 px: cambiarla habría modificado layout ajeno a este cambio. El dock presupuesta con la barra como está.
5. **`getBoundingClientRect` en el gestor, `offsetLeft` en la pista.** El índice de destino se resuelve con rects del viewport (posición del puntero), pero la línea de destino se posiciona con `offsetLeft` dentro de la pista: mezclar ambos desalinea el hueco visible cuando la pista scrollea.
6. **`timeline-transitions.cjs` y `timeline-scheduling.cjs` también estaban atadas al popup.** La tarea 7.1 solo nombraba `timeline-custom-presets.cjs`, pero las otras dos suites tocaban `.timeline-duration` y `.timeline-step.current`. Se migraron con el mismo criterio: seleccionar el clip y editar por el inspector; el resaltado de paso actual pasa a `.dock-clip.current`.
7. **El delta en vuelo de `cortex-timeline-custom-presets` describía el popup con Escape y retorno de foco.** Reconciliado (tarea 7.3): sus requisitos ahora describen el dock — clips proporcionales, inspector, reemplazos por teclado, toggle con `aria-expanded` — y su proposal lleva una nota que marca el resto como registro histórico. Los dos cambios ya no describen UIs contradictorias al archivarse.

## Trade-off documentado: clips mínimos

En sesiones muy desiguales (un paso de 1 s junto a uno de 300 s), el piso de 44 px distorsiona la proporcionalidad: los clips cortos se dibujan más anchos que su tiempo real. Es un intercambio consciente: sin piso, un clip de 1 s en una sesión de 40 min sería invisible e intocable. La distorsión nunca miente sobre el dato — el chip muestra el valor exacto y la regla marca los tiempos reales — y el playhead se posiciona contra la geometría real de los clips, no contra la proporción ideal, así que siempre coincide con los bordes visibles.

## Pendiente humano

- **8.4** — Sesión real en la pantalla del usuario (1366×768): dock desplegado, arrastre de un clip, redimensionado de otro, y escucha de una rampa con la ventana sin foco verificando que el playhead avanza y que al volver muestra la posición real. Requiere observación y escucha humanas; ningún job de CI la cubre. Protocolo en `cortex-listening-protocol.md`.
