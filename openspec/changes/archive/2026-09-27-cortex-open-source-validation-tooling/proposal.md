# Propuesta: aprender y seleccionar tooling open source para Cortex

## Por qué
Los gaps restantes de Cortex no son todos del mismo tipo: escuchar de forma ciega, renderizar HRTF, comparar píxeles, ejecutar varios motores de navegador y auditar un HTML con código embebido requieren herramientas diferentes. La existencia de una herramienta no implica que sea adecuada, mantenida, compatible con la licencia del proyecto o capaz de resolver el problema completo.

## Evaluación inicial no determinista

| Área | Herramienta | Veredicto inicial | Uso recomendado |
|---|---|---|---|
| Escucha subjetiva | webMUSHRA | **Sí, con caveat de licencia** | Harness separado para MUSHRA/AB/BS.1116 y atributos espaciales; revisión legal antes de redistribuir |
| SOFA/HRTF | libmysofa | **Sí, pero no es JS oficial** | Cargar/interpolar HRTF desde C/WASM; después hace falta convolución y routing Web Audio |
| SOFA/HRTF | libmysofa-wasm | **Existe como port separado** | Spike de navegador, no asumir madurez de producción |
| Spatial Web Audio | Resonance Audio | **Sí históricamente; no primera elección** | Estudiar arquitectura; repositorios oficiales web aparecen archivados |
| Spatial Web Audio | Omnitone | **Sí, mejor candidato de referencia** | Estudiar renderizado binaural/ambisonics con Web Audio y Convolver |
| Visual regression | BackstopJS | **Sí** | Capturas, baselines, pixel diff y reportes; no es un diff semántico ni necesariamente delta-E |
| Visual regression | Lost Pixel | **No para una dependencia nueva** | Fue open source, pero el repositorio aparece archivado en 2026 |
| Componentes visuales | Storybook | **Sí, indirecto** | Útil si separamos radar/cerebro en componentes; sobredimensionado para el HTML monolítico actual |
| Cross-browser | Playwright | **Sí** | Descargar Chromium/Firefox/WebKit y ejecutar matriz; el peso de los binarios no es trivial |
| Diff estructural | Difftastic | **Sí** | Comparar HTML/JS/CSS por estructura, no espacios; no reemplaza una revisión de comportamiento |
| Búsqueda estructural | ast-grep | **Sí** | Auditar patrones JS/HTML/CSS embebidos y construir reglas de contrato |

## Qué cambia
- Crear un registro de evidencia, licencia, mantenimiento, alcance y riesgo de cada herramienta.
- Seleccionar una ruta pequeña y reversible, no incorporar todas las herramientas.
- Mantener HRTF como spike aislado hasta comprobar calidad, latencia y compatibilidad con binaural.
- Mantener la evaluación subjetiva separada de las pruebas automáticas.
- Intentar instalar los motores Firefox/WebKit de Playwright y reportar `PASS` o `BLOCKED` con evidencia.

## No se asume
- Que "open source" significa licencia OSI estándar.
- Que leer un `.sofa` produce HRTF audible automáticamente.
- Que una visualización del radar prueba localización acústica real.
- Que un pixel diff prueba intención o calidad UX.
- Que una herramienta archivada es una buena dependencia nueva.

## Criterio de aceptación
La propuesta queda lista cuando cada herramienta tiene una decisión `ADOPT`, `SPIKE`, `REFERENCE-ONLY` o `REJECT`, con evidencia y razón; y cuando la selección no bloquea el uso actual de Cortex.
