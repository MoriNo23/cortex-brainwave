# Tareas

- [x] 1.1 Crear una matriz de evidencia con URL oficial, licencia, mantenimiento y gap cubierto. (Documentada en `tooling-evaluation.md`.)
- [x] 1.2 Confirmar el estado y licencia de webMUSHRA; decidir `ADOPT`, `SPIKE` o `REFERENCE-ONLY`. (Queda `SPIKE`; licencia propia y revisión legal pendiente.)
- [x] 1.3 Confirmar libmysofa, libmysofa-wasm, SOFA y la separación lector/convolución. (Queda documentado en `spikes/hrtf-sofa/`.)
- [x] 1.4 Comparar Resonance Audio con Omnitone y registrar riesgo de repositorio archivado. (Resonance queda `REFERENCE-ONLY`; Omnitone queda `SPIKE`.)
- [x] 2.1 Definir un harness subjetivo externo basado en webMUSHRA o una alternativa compatible. (Configuración y límites en `spikes/webmushra/`.)
- [x] 2.2 Definir el protocolo de consentimiento, volumen seguro y almacenamiento de respuestas. (`spikes/webmushra/protocol.md` y `cortex-listening-protocol.md`.)
- [x] 3.1 Intentar instalar Firefox y WebKit con Playwright y registrar PASS/BLOCKED. (Instalados junto con dependencias; PASS.)
- [x] 3.2 Ejecutar la suite WAV, Canvas y lifecycle en cada motor disponible. (Chromium, Firefox y WebKit: PASS; `artifacts/browser-matrix.json`.)
- [x] 3.3 Evaluar BackstopJS frente a snapshots nativos de Playwright; elegir solo uno inicialmente. (Comparación aislada reproducible; Playwright sigue siendo el flujo principal.)
- [x] 3.4 Marcar Lost Pixel como no recomendado para dependencia nueva si continúa archivado. (Clasificado `REJECT`.)
- [x] 4.1 Ejecutar Difftastic sobre versiones comparables de `cortex.html`. (HTML del transcript frente a la app actual; evidencia en `artifacts/audit/`.)
- [x] 4.2 Ejecutar consultas ast-grep para los contratos de estado, radar y Web Audio. (Evidencia JSON en `artifacts/audit/`.)
- [x] 4.3 Crear un spike aislado SOFA/HRTF sin modificar la ruta principal de Cortex. (`spikes/hrtf-sofa/`; probe explícitamente `NOT_EXECUTED`.)
- [ ] 4.4 Medir latencia, CPU, compatibilidad, posición y calidad subjetiva del spike. (Bloqueado honestamente: no hay renderer SOFA/HRTF instalado y la escucha requiere hardware/personas.)
- [x] 5.1 Documentar decisiones y reversibilidad en `tooling-evaluation.md`.
- [x] 5.2 Actualizar `cortex-test-report.md` con la clasificación de cada gap.
- [x] 5.3 Validar este cambio con `openspec validate --strict`. (`valid: true`, `issues: []`.)
