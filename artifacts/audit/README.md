# Evidencia de auditoría estructural

- `cortex-transcript-baseline.html`: bloque HTML extraído de `uploads/Cortex-app.md` para comparación.
- `cortex-inline.js`: JavaScript inline extraído de la app actual para que ast-grep analice JavaScript real, no HTML como sustituto.
- `cortex-diff.json` y `cortex-diff-inline.txt`: salida de Difftastic `0.70.0`.
- `ast-grep-*.json`: consultas de ast-grep `0.45.3` sobre estado stereo, conexiones Web Audio, `createStereoPanner`, radar y `requestAnimationFrame`.
- `audit-summary.json`: conteos y lectura de los resultados.

El diff estructural tiene estado `changed` y siete chunks; eso es esperado en una app reconstruida/evolucionada. La auditoría no convierte similitud estructural en prueba funcional ni auditiva.
