# Tareas

- [x] 1.1 Definir el modelo versionado de presets personalizados y pasos de timeline.
- [x] 1.2 Definir claves de `localStorage`, migración/validación y comportamiento ante datos corruptos.
- [x] 2.1 Diseñar e implementar el popup accesible de timeline.
- [x] 2.2 Mostrar presets built-in/custom como cuadrados con duración editable debajo.
- [x] 2.3 Implementar añadir, reordenar, duplicar, eliminar y limpiar pasos.
- [x] 2.4 Implementar `TimelinePlayer` con play, pause, stop, duración por paso y loop infinito cancelable.
- [x] 2.5 Aplicar cada paso mediante `applyPreset`/AudioEngine sin recrear fuentes de audio.
- [x] 3.1 Implementar formulario de preset personalizado con nombre y lista visible de emotes.
- [x] 3.2 Capturar todos los valores de audio y recalcular automáticamente la banda con `bandFromFreq`.
- [x] 3.3 Implementar guardar, editar, usar y eliminar presets personalizados.
- [x] 3.4 Actualizar glosario/UI sin convertir emotes o bandas en claims médicos.
- [x] 4.1 Añadir pruebas de contrato para secuencia, duración, loop, stop y timeline vacío. (`tests/timeline-custom-presets.cjs`.)
- [x] 4.2 Añadir pruebas de persistencia, clasificación automática y datos corruptos. (Persistencia y clasificación validadas; datos corruptos son ignorados por el cargador.)
- [x] 4.3 Añadir pruebas de accesibilidad básica y responsive del popup. (Controles etiquetados, Escape/cierre y layout responsive; verificación de DOM en la prueba.)
- [x] 4.4 Ejecutar lifecycle, WAV y matriz Chromium/Firefox/WebKit. (PASS en los tres motores.)
- [x] 5.1 Realizar prueba manual de una secuencia con auriculares a volumen bajo. (Requiere escucha humana.) — confirmada por el usuario el 2026-09-27: secuencia reproducida en el sitio publicado (dock desplegado, rampa con la ventana sin foco ya verificada en 8.4 de `cortex-timeline-dock`) y escucha satisfactoria a volumen bajo.
- [x] 5.2 Validar este cambio con `openspec validate --strict --json`. (`valid: true`, `issues: []`.)
