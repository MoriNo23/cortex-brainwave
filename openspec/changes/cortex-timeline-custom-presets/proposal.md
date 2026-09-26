# Propuesta: timeline de presets y presets personalizados

## Problema

Cortex permite cambiar presets, pero cada cambio es manual y no existe una sesión compuesta por varias ondas con duración propia. Tampoco se pueden guardar presets personalizados con una identidad visual/emote y una clasificación de banda visible.

## Objetivo

Agregar un popup accesible de “Timeline” donde el usuario pueda:

- añadir cualquier cantidad de presets;
- seleccionar los presets existentes desde sus cuadrados;
- editar debajo de cada cuadrado cuánto tiempo permanece activo;
- reordenar, duplicar y eliminar pasos;
- previsualizar la secuencia dentro del popup;
- activar un modo de repetición indefinida;
- detener la reproducción sin romper el lifecycle de AudioEngine.

Agregar además un flujo para crear presets personalizados:

- capturar el estado actual de Cortex;
- asignar nombre;
- elegir un emote de una lista visible de emotes disponibles;
- detectar automáticamente la banda a partir de la frecuencia `brainwave` usando `bandFromFreq`;
- mostrar la banda detectada debajo del emote;
- guardar, usar en el timeline, editar y eliminar presets personalizados mediante `localStorage`.

## Decisiones de alcance

- Se mantiene un HTML autónomo: sin React, Vue, servidor, bundler ni dependencia nueva.
- Un preset captura el estado sonoro relevante, no solo `brainwave`: carrier, amod, binaural, stereo, f-mod, noise y mix.
- La duración de cada paso es el tiempo de permanencia del preset. La transición entre pasos usará las actualizaciones/rampas existentes del motor; no se promete un crossfade separado hasta medirlo.
- El loop será explícito y visible; al terminar el último paso vuelve al primero solo si está activado.
- La banda es una clasificación por frecuencia, no una afirmación médica ni una identificación EEG.
- Los emotes son etiquetas visuales; no se afirma que un emote produzca una emoción o estado mental.

## Criterio de aceptación

La propuesta está lista cuando un usuario puede construir una secuencia de longitud arbitraria, editar duraciones, reproducirla una vez o en loop, detenerla y reutilizarla; y cuando puede crear/guardar un preset personalizado con emote y banda autoidentificada, cerrar y reabrir la app conservando la información sin servidor.
