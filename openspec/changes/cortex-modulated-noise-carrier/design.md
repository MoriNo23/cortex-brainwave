# Diseño: portadora de ruido filtrada

## Grafo de audio en vivo

La ruta base será:

```text
carrierOsc → carrierGain ┐
                         ├→ amModGain → masterGain → destination
noise L/R → bandpass L/R → noisePan L/R → noiseBlendGain ┘
```

- `carrierGain.gain = 0.25 * (1 - noise/100)`.
- `noiseBlendGain.gain = 0.25 * (noise/100)`.
- El ruido usa fuentes L/R independientes y panners fijos -1/+1 para evitar que una sola fuente mono se sienta como un zumbido central.
- Ambos componentes entran en `amModGain`, por lo que `a-mod` puede afectar la mezcla base.
- La ruta binaural y la ruta stereo existentes se conservan como capas separadas y no se duplican.

## Filtros y modulación

Cada canal de ruido usa `BiquadFilterNode`:

- `type = bandpass`;
- `frequency = state.carrier`;
- `Q = 2` como punto de partida audible, documentado y ajustable solo mediante código.

`f-mod` se conecta a un `noiseFilterDepth` propio. La desviación se calcula con una proporción del carrier (`carrier * fmod / 150`) y se limita a un rango válido para el filtro y el Nyquist. El carrier senoidal conserva su profundidad de FM actual para no cambiar de forma inesperada el comportamiento existente.

Cuando cambia `Carrier`, se actualizan el oscilador, los osciladores binaurales/stereo y las dos frecuencias de filtro. Cuando cambia `f-mod`, se actualiza la profundidad de modulación de los filtros.

## Exportación WAV

`exportWav()` debe construir el mismo subgrafo con `OfflineAudioContext`:

- dos buffers de ruido independientes;
- dos filtros bandpass centrados en `state.carrier`;
- la misma mezcla `noise ↔ sine`;
- la misma modulación de filtro por `f-mod`;
- el mismo `amod` y `mix`.

No se acepta que la escucha en vivo tenga una ruta y el WAV otra.

## UI y texto

Actualizar el glosario y el readout para no llamar al control solo “ruido de fondo”. Describirlo como “portadora de ruido filtrada alrededor del carrier; puede mezclarse con la senoide”. El radar seguirá siendo una visualización de intención, no una medición HRTF.

## Compatibilidad y seguridad

- Mantener Web Audio API nativa y HTML autocontenido.
- Reconstruir y detener las nuevas fuentes L/R junto con el lifecycle existente.
- Limitar ganancias para evitar clipping.
- Mantener el mensaje de escucha a volumen bajo y detener ante molestia.
- No incluir código del sitio de referencia; solo la idea de señal se implementa de forma independiente.
