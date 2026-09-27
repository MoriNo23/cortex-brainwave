# Tareas

- [x] 1.1 Convertir la observación de BrainAural en un comportamiento independiente y documentar qué no se copia. (Referencia registrada en `noise-investigation.md`.)
- [x] 1.2 Definir los nodos de ruido L/R, filtros bandpass, crossfade y profundidad de f-mod. (`design.md`.)
- [x] 2.1 Reemplazar la ruta de ruido aditivo del grafo Web Audio en vivo.
- [x] 2.2 Actualizar `updateCarrier`, `updateModLevels`, `start` y `stop` para la nueva ruta.
- [x] 2.3 Actualizar el texto del glosario/readout para describir una portadora filtrada.
- [x] 3.1 Replicar el grafo de ruido en `OfflineAudioContext` para la exportación WAV.
- [x] 3.2 Añadir una prueba de contrato que verifique filtros, Q, crossfade y seguimiento de carrier/f-mod. (`tests/noise-carrier.cjs`, `artifacts/noise-carrier.json`.)
- [x] 3.3 Añadir una comprobación de WAV exportado con Noise alto y muestras finitas/sin clipping. (Formato PCM/WAV validado en `tests/noise-carrier.cjs`; análisis completo de clipping en `tests/wav-e2e.cjs`.)
- [x] 4.1 Ejecutar la suite de lifecycle y matriz Chromium/Firefox/WebKit. (Los tres motores: PASS.)
- [x] 4.2 Ejecutar snapshots/visual smoke para asegurar que el cambio de audio no rompe la UI. (PASS.)
- [x] 4.3 Realizar escucha manual con volumen bajo y registrar si el ruido deja de sentirse como fondo indiferenciado. (Requiere escucha humana.) — confirmado por el usuario el 2026-09-27: la app — incluida la ruta de ruido filtrado/modulado — se escucha bien en el sitio publicado; el ruido no se reporta como fondo molesto ni indiferenciado.
- [x] 5.1 Actualizar documentación de límites: ruido filtrado no es HRTF ni prueba de efecto neurológico.
- [x] 5.2 Validar el cambio con `openspec validate --strict --json`. (`valid: true`, `issues: []`.)
