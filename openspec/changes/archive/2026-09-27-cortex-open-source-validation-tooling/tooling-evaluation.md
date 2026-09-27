# Evaluación de tooling open source — Cortex

Fecha de esta evaluación: 2026-09-18. Alcance: pruebas automatizables, visuales y auditivas de `cortex.html`, sin convertir automáticamente ninguna herramienta en dependencia de producción.

## Decisión global

La aplicación conserva una sola frontera de runtime: `cortex.html` y sus APIs Web Audio/Canvas/SVG. Las herramientas de esta propuesta son de test, auditoría o experimentación aislada. No se añadió `webMUSHRA`, libmysofa, libmysofa-wasm, Omnitone, BackstopJS, Storybook, Lost Pixel, Resonance Audio, Difftastic ni ast-grep al runtime.

## Clasificación

| Herramienta | Veredicto | Alcance aprobado | Licencia / mantenimiento / riesgo | Evidencia |
|---|---|---|---|---|
| Playwright | `ADOPT` | Pruebas automatizables, DOM, Canvas/SVG, WAV y matriz Chromium/Firefox/WebKit | Paquete de test, no runtime. El paquete y los binarios de navegador tienen que conservar sus avisos/condiciones por separado; los binarios son grandes y se gestionan en caché. | `tests/*.cjs`, `artifacts/browser-matrix.json`, `artifacts/visual/` |
| Difftastic | `ADOPT` | Auditoría estructural de cambios HTML/JS/CSS durante desarrollo | MIT en el proyecto; parsers vendorizados pueden tener avisos MIT/Apache adicionales. Binario fijado en `tools/difftastic/difft`. | `artifacts/audit/cortex-diff.json`, `tools/README.md` |
| ast-grep | `ADOPT` | Búsqueda AST/lint/rewrite de JavaScript inline; solo auditoría/desarrollo | MIT reportada por el proyecto; fijar versión y revisar dependencias transitorias antes de CI. Ejecutado como CLI `0.45.3`, no runtime. | `artifacts/audit/ast-grep-*.json` |
| webMUSHRA | `SPIKE` | Harness externo para escucha subjetiva y comparación MUSHRA | Tiene licencia propia “Software License for the webMUSHRA.js Software”, condiciones de redistribución y advertencia de patentes; no se resume como MIT/OSI. Revisión legal pendiente. | `spikes/webmushra/` |
| libmysofa | `SPIKE` | Lector de SOFA en un spike HRTF aislado | BSD-3-Clause para el lector C según fuentes consultadas. Leer SOFA no implementa por sí solo delays/FIR ni HRTF audible. | `spikes/hrtf-sofa/` |
| libmysofa-wasm | `SPIKE` | Port WASM experimental para obtener/interpolar IRs SOFA | El repositorio incluye licencia y atribuciones BSD-3-Clause para el código descrito, pero el alcance exacto del port, parsers y archivos SOFA debe revisarse como proyecto propio; no heredar automáticamente la licencia del lector C. El README documenta una construcción no trivial y pasos posteriores de delays/FIR. | `spikes/hrtf-sofa/README.md` |
| Omnitone | `SPIKE` | Renderer espacial binaural a evaluar de forma aislada | Apache-2.0 en el repositorio consultado; aun así requiere revisión de mantenimiento, API y compatibilidad en el commit que se elija. No se asume que una referencia histórica esté lista para runtime. | `spikes/hrtf-sofa/README.md` |
| BackstopJS | `SPIKE` | Comparación puntual contra un snapshot nativo de Playwright | MIT; útil como comparador, pero duplicaría flujo/referencias si se adopta sin necesidad. La ejecución mostró 1.26% de diferencia con umbral 0.1% por estado animado. | `spikes/backstop/`, `spikes/backstop/bitmaps_test/` |
| Storybook | `SPIKE` | Posible aislamiento de componentes y pruebas visuales después de separar `cortex.html` | Proyecto mantenido y open source; el uso útil depende de extraer componentes. No introducirlo para una página monolítica todavía; sus flujos de visual testing pueden implicar servicios externos según el addon. | Decisión pendiente, sin instalación |
| Resonance Audio | `REFERENCE-ONLY` | Referencia histórica para spatial audio Web Audio | Apache-2.0 en el repositorio consultado, pero el repositorio/SDK aparece archivado; no es una base razonable para adopción nueva aunque el código sea útil para estudiar ideas. | Fuentes en la sección de referencias |
| Lost Pixel | `REJECT` | Ninguno como dependencia nueva | MIT no compensa el riesgo de mantenimiento: el repositorio consultado aparece archivado el 2026-04-22 y de solo lectura. | Fuentes en la sección de referencias |

## Evidencia ejecutada

### Playwright

```text
Chromium: PASS
Firefox: PASS
WebKit: PASS
```

La matriz confirmó en los tres motores DOM expuesto por test, lifecycle `reproduciendo → detenido → reproduciendo`, Canvas/radar, ausencia de overflow horizontal, descarga WAV y ausencia de errores. Después de endurecer `tests/browser-matrix.cjs`, el parser PCM16 comprobó en cada motor formato, canales, frecuencia, duración, RMS, picos, clipping y valores finitos; `tests/wav-e2e.cjs` conserva además la ejecución dedicada en Chromium. Esto prueba automatización y compatibilidad de ejecución, no escucha ni HRTF.

### Difftastic y ast-grep

- Difftastic `0.70.0` comparó el HTML extraído del transcript con `cortex.html`: lenguaje `HTML`, estado `changed`, siete chunks.
- ast-grep `0.45.3` encontró, sobre el JavaScript inline extraído, 42 conexiones Web Audio, seis llamadas `createStereoPanner`, una función `drawRadarFrame`, dos llamadas `requestAnimationFrame` y una asignación `state.stereo = d.stereo`.
- La extracción del script inline se conserva en `artifacts/audit/cortex-inline.js` para que las consultas sean repetibles. El resultado es una auditoría estructural, no una equivalencia de comportamiento.

### Comparación BackstopJS / Playwright

El snapshot de referencia de Backstop se sustituyó por `artifacts/visual/native-page-desktop.png` tomado por Playwright a 1440×900. BackstopJS `6.3.25` generó una captura con las mismas dimensiones y reportó diferencia bruta `1.26%` frente a umbral `0.1%`; el comando terminó `FAIL`. La causa operativa esperada es que la app mantiene animaciones y estado temporal. Este resultado demuestra que la comparación funciona, pero no justifica duplicar el tooling nativo ni se interpreta como regresión de producto.

### HRTF / escucha

`node spikes/hrtf-sofa/probe.cjs` genera `artifacts/hrtf-sofa-probe.json` con `status: NOT_EXECUTED`. El probe confirma que la app contiene panoramización (`createStereoPanner`) pero no contiene parser SOFA, dataset HRTF, renderer de delays/FIR ni sesión humana. El protocolo webMUSHRA está preparado, pero no se ejecutó por la revisión legal pendiente y porque la evaluación subjetiva requiere hardware y personas.

## Límites que se mantienen

No se presenta como HRTF real ninguno de los siguientes: WAV válido, separación estéreo, `StereoPannerNode`, snapshot visual, diff de píxeles o salida cross-browser. Las afirmaciones espaciales quedan separadas en tres niveles: automatización, inspección de grafo/artefactos y escucha humana con protocolo.

## Referencias primarias

- Playwright: <https://playwright.dev/docs/library>
- webMUSHRA: <https://github.com/audiolabs/webMUSHRA> y licencia <https://github.com/audiolabs/webMUSHRA/blob/master/LICENSE.txt>
- libmysofa: <https://github.com/hoene/libmysofa>
- libmysofa-wasm: <https://github.com/ColumbiaCEAL/libmysofa-wasm>
- Omnitone: <https://github.com/GoogleChrome/omnitone>
- BackstopJS: <https://github.com/garris/backstopjs>
- Storybook visual testing: <https://storybook.js.org/docs/writing-tests/visual-testing>
- Lost Pixel: <https://github.com/lost-pixel/lost-pixel>
- Resonance Audio Web SDK: <https://github.com/resonance-audio/resonance-audio-web-sdk>
- Difftastic: <https://github.com/Wilfred/difftastic>
- ast-grep: <https://ast-grep.github.io/guide/introduction>
