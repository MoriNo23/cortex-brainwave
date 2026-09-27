# Tasks

> ## Cómo se verifica este cambio
>
> Casi todas las verificaciones de este cambio son **de UI renderizada** — el dock a 1366×768,
> si tapa la barra de estado, si el playhead avanza sin disparar layout, si la selección y el
> inspector funcionan. `npm run verify:light` **no puede contestarlas**: solo lee archivos
> (sintaxis, autocontención, ids del DOM, forma del arreglo `TESTS`).
>
> El camino correcto, según `AGENTS.md`:
>
> 1. `npm run verify:light` antes y después de cada tarea, para lo que sí cubre.
> 2. Escribir el test de Playwright de cada comportamiento y **registrarlo en el workflow de
>    CI** (tarea 7.5). La corrida ocurre en GitHub Actions, no en la máquina.
> 3. **No lanzar un navegador en local** por iniciativa propia. Una corrida local levanta
>    Chromium y satura la máquina; solo se hace si el usuario la pide explícitamente, y se
>    reporta una sola vez, acotada a lo pedido.
>
> Lo que un archivo no puede verificar —que el dock no tape el transporte a 1366×768, que el
> arrastre y el redimensionado se sientan bien— queda para la tarea 8.4, que es humana.

## 1. Estructura del dock

- [ ] 1.1 Añadir el contenedor del dock entre el grid principal y la barra de estado con los dos estados (plegado ~48 px / desplegado ~170 px), y verificar en 1366×768 que desplegado no oculta el transporte ni la barra de estado ni la zona cerebral.
- [ ] 1.2 Migrar el transporte (reproducir, pausar, detener, limpiar, loop) del modal al toolbar del dock, y verificar que cada control funciona igual que antes y que el estado plegado los mantiene disponibles.
- [ ] 1.3 Migrar los controles de transición (interruptor, duración, unidad s/min, pista) al toolbar del dock, y verificar que el comportamiento en vivo (`refreshTransition`) y la persistencia no cambian.
- [ ] 1.4 Reconvertir `#btnOpenTimeline` en el toggle de plegado/desplegado y persistir la preferencia en `cortex-settings`, y verificar que tras recargar el dock vuelve al estado elegido.
- [ ] 1.5 Eliminar el `<dialog id="timelineDialog">`, sus estilos y sus manejadores (Escape, cierre, retorno de foco), y verificar que no queda código muerto referenciando el modal.

## 2. Clips y pista

- [ ] 2.1 Dividir el render: estructura del dock al montar/plegar y clips por cambio de pasos, con listeners delegados en la pista (no por clip), y verificar que añadir un paso no duplica handlers.
- [ ] 2.2 Renderizar los pasos como clips proporcionales a su duración (ajuste a la vista) con color por banda, emote, nombre con elipsis y chip de duración en la unidad vigente, y verificar con pasos de 10/20/30 s que los anchos guardan la proporción dentro de la tolerancia del ancho mínimo de 44 px.
- [ ] 2.3 Añadir la regla de tiempos sobre la pista (marcas en la unidad vigente) y verificar que las marcas coinciden con los límites de los clips.
- [ ] 2.4 Migrar la tira de presets (picker) al dock desplegado y verificar que añadir pasos desde la tira funciona igual que antes.

## 3. Playhead

- [ ] 3.1 Implementar el playhead como un único nodo movido con `transform` desde el rAF existente, calculando la posición desde `remainingMs` y las duraciones acumuladas, y verificar que avanza dentro del clip activo sin disparar layout del dock.
- [ ] 3.2 Hacer que el playhead cruce al clip siguiente, reinicie en loop y se resincronice al volver de segundo plano, y verificar los tres casos (cruce, loop, `visibilitychange`).

## 4. Selección e inspector

- [ ] 4.1 Implementar la selección por click con el clip resaltado, y verificar que solo un clip queda seleccionado y que el inspector muestra sus datos.
- [ ] 4.2 Implementar el inspector (nombre, editor de duración con unidades s/min, aplicar, mover, duplicar, eliminar), y verificar que editar la duración actualiza el ancho del clip y reprograma el paso en curso sin el piso de 1 s.
- [ ] 4.3 Implementar doble click para aplicar el preset, y verificar que aplica con su etiqueta como el click sobre las tarjetas actuales.

## 5. Gestos

- [ ] 5.1 Implementar el arrastre horizontal de clips con Pointer Events (umbral de 4 px, `setPointerCapture`, hueco de destino visible, `pointercancel` que revierte, render de clips pausado durante el gesto), y verificar que soltar en otra posición reordena y persiste.
- [ ] 5.2 Implementar el redimensionado por el borde derecho (zona de 8 px) con snap de 1 s en segundos y 30 s en minutos, y verificar que el resultado queda dentro de 1–3600 s y actualiza chip, ancho y persistencia.
- [ ] 5.3 Verificar que los reemplazos por teclado (botones de mover del inspector y editor de duración) producen los mismos resultados que los gestos.

## 6. Accesibilidad y responsive

- [ ] 6.1 Añadir roles y etiquetas (pista como lista, clips como botones con nombre/banda/duración, inspector como toolbar, gestos con `aria-describedby` hacia el reemplazo por teclado), y verificar con un auditorio manual del DOM que nada queda sin etiqueta.
- [ ] 6.2 Comportamiento bajo 900 px: pista con scroll horizontal sin desborde de página, y verificar en 390×844 que el dock es usable y el resto de la app no desborda.

## 7. Migración de suites y delta en vuelo

- [ ] 7.1 Actualizar `tests/timeline-custom-presets.cjs`: `#btnOpenTimeline` ahora despliega el dock, la edición de duración pasa por seleccionar el clip y usar el inspector, y verificar que sus aserciones de orden/duplicar/eliminar/loop siguen pasando.
- [ ] 7.2 Actualizar los casos de `cortex.spec.html` atados al popup (Escape, cierre, foco) por casos de dock (plegar/desplegar, selección, proporcionalidad), y verificar la suite in-page completa.
- [ ] 7.3 Reconciliar el delta en vuelo de `cortex-timeline-custom-presets` para que describa el dock en vez del popup (mismo comportamiento, otra superficie), y verificar que ningún requisito suyo contradice este cambio.
- [ ] 7.4 Crear `tests/timeline-dock.cjs`: proporcionalidad, playhead (avance, cruce, loop, resync), selección e inspector, gestos y sus reemplazos, plegado/desplegado con persistencia, presupuesto de alto en 1366×768; los escenarios que no exigen reloj de audio marcados `needsClock: false` para que corran también en Firefox headless.
- [ ] 7.5 Añadir el test al workflow de CI (job suite + matriz de motores) y registrar los conteos por motor en el reporte.

## 8. Cierre

- [ ] 8.1 Documentar en el glosario el dock, el playhead y los gestos con su reemplazo por teclado, sin afirmaciones médicas.
- [ ] 8.2 Escribir el reporte del cambio (evidencia de CI, hallazgos, presupuesto de alto verificado) y dejar anotado el trade-off de los clips mínimos.
- [ ] 8.3 Validar con `openspec validate cortex-timeline-dock --strict --json` y anotar el resultado.
- [ ] 8.4 Verificación humana en la pantalla del usuario: sesión real con el dock desplegado a 1366×768, arrastre de un clip, redimensionado de otro, y escucha de una rampa con la ventana sin foco, verificando que el playhead avanza y que al volver muestra la posición real. (Requiere observación y escucha humana.)
