# Propuesta: ruido como portadora filtrada y modulable

## Problema

El control `Noise` actual genera ruido blanco mono y lo suma directamente al `masterGain`. El resultado se percibe como una capa de fondo que puede enmascarar el carrier, pero no como una textura/portadora relacionada con la frecuencia elegida.

La inspección de BrainAural muestra otra estrategia: ruido generado por separado, filtrado alrededor del `carrier`, mezclado contra la senoide y conectado a una ruta que permite modulación. Se usará como referencia de comportamiento, sin copiar su código ni afirmar equivalencia completa.

## Objetivo

Hacer que `Noise` sea una portadora de ruido útil:

- `0%` conserva la senoide actual;
- `100%` deja una textura de ruido filtrado alrededor de `Carrier`;
- los valores intermedios hacen crossfade entre senoide y ruido filtrado;
- al cambiar `Carrier`, se mueve el centro del filtro;
- `f-mod` mueve también el centro del filtro de ruido;
- `a-mod` y `Mix` siguen afectando la salida de la misma forma;
- el WAV exportado utiliza la misma arquitectura que la reproducción en vivo.

## No objetivos

- No copiar JavaScript, HTML ni valores privados de BrainAural.
- No implementar HRTF, convolución SOFA ni espacialización real.
- No añadir frameworks ni dependencias de producción.
- No prometer efectos neurológicos o terapéuticos.
- No cambiar el significado de `binaural` o `stereo` más allá de conectar la nueva portadora base a la ruta común de amplitud.

## Criterio de aceptación

El cambio queda listo cuando la ruta de ruido está filtrada y modulada en vivo y en el exportador WAV, el lifecycle sigue funcionando, las pruebas muestran crossfade y seguimiento de `Carrier`/`f-mod`, y una escucha manual confirma que el ruido aporta una textura centrada en el carrier en vez de un ruido blanco indiferenciado.
