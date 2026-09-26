# Propuesta: cerrar validaciones pendientes de Cortex

## Por qué
La primera ronda validó el contrato lógico, el radar, el ciclo de vida de Web Audio, el responsive en Chromium y la capacidad de la suite para detectar una mutación. El reporte dejó explícitamente fuera cinco áreas: exportación WAV real, análisis de la señal exportada, comparación visual cross-browser, calidad acústica por dispositivo y percepción subjetiva/HRTF.

Esta propuesta continúa las validaciones sin declarar como "testeable por código" lo que depende de oídos, auriculares, DAC o hardware del usuario.

## Qué cambia
- Añadir una validación end-to-end del botón `.wav`: descarga, cabecera RIFF/WAVE, canales, sample rate, duración y muestras no silenciosas.
- Analizar la señal exportada para detectar NaN, clipping excesivo, silencio inesperado y diferencias de canal cuando corresponde.
- Crear snapshots visuales deterministas del radar y cerebro en Chromium, y una matriz para Chromium/Firefox/WebKit cuando los motores estén disponibles.
- Documentar un protocolo manual para escucha con auriculares/parlantes y registrar observaciones del usuario.
- Separar tres resultados: **PASS automatizable**, **PASS condicionado a hardware/usuario** y **NO APLICA/BLOQUEADO**.
- Actualizar el reporte sin prometer HRTF real: la app actual visualiza intención espacial, no genera una ruta HRTF completa.

## No se hará en esta propuesta
- No se implementará HRTF ni se rediseñará el motor de audio.
- No se calificará la calidad subjetiva de sonido sin una persona escuchando.
- No se afirmará que un archivo WAV correcto implica una percepción espacial correcta.

## Criterio de aceptación
La propuesta queda validada cuando cada gap del reporte original tiene uno de estos estados documentados: prueba automatizada reproducible, prueba manual con protocolo y resultado, o bloqueo explícito con la razón técnica.
