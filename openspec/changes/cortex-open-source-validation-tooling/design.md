# Diseño técnico

## Método de evaluación

Cada candidato recibe una ficha:

- URL oficial y commit/release consultado;
- licencia exacta y obligaciones;
- estado de mantenimiento;
- browser/runtime soportado;
- tamaño y dependencias;
- qué gap cubre y cuál no cubre;
- coste de integración y posibilidad de rollback;
- clasificación: `ADOPT`, `SPIKE`, `REFERENCE-ONLY`, `REJECT`.

## Recomendación provisional

1. **Mantener Playwright** para E2E, descarga WAV, snapshots y matriz de motores.
2. **Añadir BackstopJS solo si** se necesita un HTML review report más cómodo que el diff de Playwright. No duplicarlo de entrada.
3. **Usar webMUSHRA como harness externo** para escucha subjetiva; no mezclar sus resultados con asserts automáticos.
4. **Estudiar Omnitone y libmysofa-wasm** en un spike aislado. La ruta mínima sería: SOFA → HRIR izquierda/derecha → FIR/convolution → fuente mono espacializada → salida; mantener el camino binaural actual separado.
5. **Usar Difftastic + ast-grep de forma puntual** para comparar/auditar el HTML monolítico, no como dependencia runtime.
6. **No elegir Lost Pixel para una integración nueva** mientras el repositorio siga archivado.
7. **No introducir Storybook hasta** separar `SpatialRadar`, `BrainMap` y `Waveform` de `cortex.html`.

## HRTF: límites técnicos

SOFA es un formato estándar de datos espaciales, no una API única. Un lector proporciona datos; todavía hay que seleccionar/interpolar una posición, aplicar filtros FIR, gestionar delay, sample rate, latencia y cambios suaves de posición. Resonance Audio/Omnitone pueden enseñar patrones de arquitectura, pero su estado de mantenimiento y el tipo de entrada deben comprobarse antes de adoptar.

## Visual regression

El estado debe ser determinista: detener el render loop o invocar un render con tiempo de fase controlado, desactivar transiciones CSS y capturar Canvas/SVG después de estabilizar. Usar una tolerancia explícita para antialiasing, por ejemplo pixel diff con threshold y ratio máximo; no llamar a ese valor delta-E salvo que se use realmente un algoritmo CIE.

## Cross-browser

El pipeline debe instalar solo los motores necesarios en CI, cachear binarios y conservar el reporte por motor. La ausencia de Firefox/WebKit es `BLOCKED`, no un PASS implícito.

## Artefactos

- `tooling-evaluation.md`: matriz de decisión.
- `tests/` o `tooling-spikes/`: experimentos ejecutables.
- `artifacts/`: logs, snapshots, diffs y tamaños.
- `cortex-test-report.md`: resumen de resultados, incluyendo manual/HRTF.
