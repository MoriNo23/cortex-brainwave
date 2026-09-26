# Diseño técnico

## Capas de verificación

1. **Estática**: estructura HTML, scripts, export `window.__CORTEX__`, ausencia de fences Markdown, parseo con `node --check`.
2. **Lógica**: `bandFromFreq`, presets, derivación de bandas, limpieza de regiones.
3. **Audio mockeado**: `AudioContext`/`AudioParam` espías para comprobar nodos, conexiones, rampas, valores y ciclo de vida.
4. **Visual mockeado**: DOM/SVG y Canvas 2D espía. Se verifican llamadas geométricas y clases; no se confunden con comparación de píxeles.
5. **Animación**: frames detenidos/reproduciendo, cambios de fase y ausencia de excepciones durante varios frames.
6. **Navegador real**: runner `cortex.spec.html` cargado en iframe; opcionalmente Playwright/Chromium para ejecutar el runner. El audio real debe validarse como smoke test, no como medición psicoacústica.

## Contrato de prueba

La app expone, solo para test, `window.__CORTEX__` con estado, motor y funciones puras/observables. Esta exportación no debe convertirse en API pública de producto.

El mock debe registrar:
- tipo y cantidad de nodos;
- `connect`, `start`, `stop`;
- historial de `AudioParam`;
- llamadas `ellipse`, `arc`, `lineTo`, estilos y texto del Canvas.

## Regresión crítica identificada

El `AudioBufferSourceNode` y los `OscillatorNode` no se pueden reiniciar después de `stop()`. Por tanto, `start()` no debe reutilizar fuentes detenidas. La solución preferida es reconstruir las fuentes efímeras al reiniciar y mantener referencias al grafo actual; una alternativa es no detener fuentes y controlar un gain de sesión, pero debe evitar duplicación y fugas.

## Estado detenido del radar

El campo dinámico debe condicionarse a `state.playing`. Los moduladores pueden seguir visibles como configuración en el readout, pero no como emisión activa mientras está detenido.

## Limitaciones

Un mock valida el contrato de programación, no el audio audible. Un Canvas spy valida geometría declarada, no rasterización, color final, layout responsive ni accesibilidad visual. HRTF y percepción frente-atrás requieren una prueba acústica separada y no se infieren del radar.
