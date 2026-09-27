# Propuesta: testing especializado para Cortex

## Por qué
Cortex combina un grafo Web Audio, parámetros de modulación, un mapa SVG del cerebro, un radar espacial en Canvas y animaciones sincronizadas. Un test convencional de DOM no detecta regresiones importantes: un slider puede actualizar el texto pero no el `AudioParam`, el radar puede dejar de reaccionar o el motor puede fallar al reiniciar después de detenerse.

El objetivo es convertir la prueba puntual del radar en una estrategia reproducible para este tipo de aplicaciones híbridas.

## Qué cambia
- Definir una batería de pruebas por capas: lógica, audio, visualización SVG/Canvas, animación, UI y persistencia.
- Verificar el contrato entre cada control y sus efectos observables.
- Añadir escenarios anti-regresión para `stereo`, `f-mod`, `binaural`, `a-mod`, `noise` y `brainwave`.
- Verificar los estados `detenido → reproduciendo → detenido → reproduciendo`.
- Mantener una separación explícita entre lo que se puede verificar con mocks y lo que requiere un navegador/audio real.
- Ejecutar validaciones estáticas y el runner de navegador cuando exista un navegador automatizable.

## Fuera de alcance
- Afirmar que el radar visual mide una percepción HRTF real.
- Validar la respuesta acústica de un DAC o la percepción subjetiva del usuario.
- Convertir el carrier senoidal en un sistema HRTF completo.

## Criterio de aceptación
La app no se acepta si falla una prueba crítica de contrato, si no puede reiniciarse tras detenerse, si un control no cambia su representación correspondiente o si las pruebas del runner no son sintácticamente ejecutables.
