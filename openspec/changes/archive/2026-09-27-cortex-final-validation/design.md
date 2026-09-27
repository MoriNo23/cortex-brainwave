# Diseño técnico

## 1. WAV end-to-end

Usar Playwright para abrir `cortex.html`, configurar una sesión conocida y hacer click en `.wav`. Capturar la descarga con `page.waitForEvent('download')`; no confiar solo en el toast. Leer el archivo como `Buffer` y validar:

- `RIFF` en offset 0;
- `WAVE` en offset 8;
- chunk `fmt ` y `data` presentes;
- PCM 16-bit declarado por el exportador;
- `numChannels`, `sampleRate`, `byteRate`, `blockAlign` coherentes;
- `dataSize` igual al tamaño real del archivo menos 44 bytes;
- muestras finitas, rango [-1, 1] y RMS no nulo cuando corresponde.

La exportación actual renderiza 60 segundos a 44.1 kHz y puede consumir memoria. El test debe tener timeout amplio y limpiar el archivo temporal.

## 2. Análisis de canales

Calcular RMS y correlación por canal. No exigir diferencias para todos los presets: una señal mono o un carrier sin separación puede tener canales similares. Para binaural, registrar si la diferencia aparece en las muestras; no convertir este análisis en una afirmación de percepción subjetiva.

## 3. Snapshots

Preferir una función de render con estado controlado o capturar Canvas después de llamar explícitamente a `drawRadarFrame()`. Usar una tolerancia de pixel diff para antialiasing. Comparar al menos:

- radar base vs stereo 80;
- radar base vs f-mod 80;
- radar binaural 80;
- cerebro Delta vs Alpha vs Beta;
- viewport desktop y móvil.

## 4. Cross-browser

Matriz inicial:

| Motor | Smoke DOM | Canvas | WAV | AudioContext | Estado |
|---|---:|---:|---:|---:|---|
| Chromium | sí | sí | sí | sí | ejecutar |
| Firefox | sí | sí | sí | sí | ejecutar si instalado |
| WebKit | sí | sí | sí | sí | ejecutar si instalado |

No ocultar un motor no instalado. La salida debe indicar versión del motor y motivo de bloqueo.

## 5. Escucha manual

Entregar una hoja de registro con: navegador/versión, sistema operativo, dispositivo de salida, auriculares/parlantes, volumen relativo, carrier, brainwave, moduladores, si se percibe movimiento L/R, artefactos, fatiga y comentarios. No usar tonos fuertes ni presentar la app como tratamiento médico.

## 6. HRTF

No se considera validable como audio real en esta ronda porque `StereoPannerNode` no equivale a HRTF y el carrier senoidal puro no contiene todas las pistas espectrales necesarias para una localización frente-atrás fiable. Solo se verifica que la advertencia/documentación no prometa más de lo implementado.
