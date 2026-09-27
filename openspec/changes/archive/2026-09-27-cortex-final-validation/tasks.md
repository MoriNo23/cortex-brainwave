# Tareas

- [x] 1.1 Revisar el reporte `cortex-test-report.md` y convertir cada gap en un caso verificable.
- [x] 1.2 Añadir parser de WAV PCM para validar RIFF, `fmt `, `data`, duración y muestras.
- [x] 1.3 Añadir smoke E2E de descarga `.wav` con Playwright.
- [x] 1.4 Medir RMS, clipping, finitud y diferencias entre canales.
- [x] 2.1 Crear snapshots deterministas del radar para base, stereo, f-mod y binaural.
- [x] 2.2 Crear snapshots del mapa cerebral para Delta, Alpha y Beta.
- [x] 2.3 Definir tolerancia de pixel diff y reporte de diferencias.
- [x] 3.1 Ejecutar matriz en Chromium.
- [x] 3.2 Intentar Firefox y WebKit; marcar `BLOCKED` si faltan motores/dependencias.
- [x] 3.3 Comparar resultados DOM, Canvas, descarga y AudioContext por motor.
- [x] 4.1 Entregar protocolo de escucha manual con volumen seguro y hoja de registro.
- [x] 4.2 Solicitar al usuario el resultado con sus auriculares/parlantes. — resultado recibido el 2026-09-27: el usuario escuchó la app en el sitio publicado y reporta que se escucha bien.
- [x] 4.3 Registrar observaciones subjetivas sin presentarlas como HRTF o evidencia médica. — registrado: escucha satisfactoria según el usuario (auriculares/parlantes, volumen bajo). Observación subjetiva de usabilidad; no es una medida HRTF ni evidencia clínica de ningún tipo.
- [x] 5.1 Actualizar `cortex-test-report.md` con estados PASS/FAIL/BLOCKED/MANUAL-PENDING.
- [x] 5.2 Validar este cambio con `openspec validate --strict`.
