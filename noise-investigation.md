# Investigación del uso de `noise` en BrainAural frente a Cortex

Fecha: 2026-09-18  
Referencia inspeccionada: https://brainaural.com/

## Conclusión

La observación es correcta: el `noise` de BrainAural no es simplemente ruido blanco sumado directamente a la salida. En el código inline de la página, el ruido funciona como una alternativa de portadora y atraviesa parte del mismo sistema de modulación.

La implementación actual de Cortex es deliberadamente más simple: genera ruido blanco mono y lo añade directamente al `masterGain` con un nivel independiente. Por eso `noise` no sigue actualmente el mismo comportamiento que BrainAural.

## Qué hace BrainAural

La implementación observada en la página hace, de forma resumida, lo siguiente:

1. Genera un buffer de ruido aleatorio de varios segundos.
2. Crea fuentes separadas para izquierda y derecha; la fuente derecha comienza en otro offset del buffer.
3. Pasa cada canal por un `BiquadFilter` de tipo `bandpass`.
4. Centra el filtro en la frecuencia `carrier` y usa `Q = 2`.
5. La frecuencia del filtro también recibe la modulación asociada a `f-mod`.
6. Hace crossfade entre el oscilador senoidal y el ruido:
   - `noise = 0%`: predomina la senoide;
   - `noise = 100%`: predomina el ruido filtrado;
   - valores intermedios: mezcla de ambos.
7. El ruido pasa por la ruta estéreo/modulación antes de la salida, en vez de conectarse directamente al master.

La página describe explícitamente el ruido como una posible portadora, utilizable solo o mezclado con el tono, y habla de “modulated white noise”. Fuente: [BrainAural](https://brainaural.com/).

## Qué hace Cortex actualmente

En `cortex.html`:

- crea un buffer mono de ruido blanco de aproximadamente dos segundos;
- utiliza una única fuente en loop;
- conecta esa fuente a `noiseGain`;
- conecta `noiseGain` directamente a `masterGain`;
- controla su nivel con `state.noise / 100 * 0.15`;
- mantiene la senoide en una ruta separada.

Por tanto, el ruido actual:

- no está filtrado alrededor de `carrier`;
- no es una portadora alternativa;
- no recibe `f-mod` mediante la frecuencia de un filtro;
- no se mezcla como crossfade con la senoide;
- no atraviesa la misma ruta de binaural/stereo/a-mod;
- funciona como ruido blanco de fondo o capa aditiva.

Esto no es un fallo de las pruebas existentes: las pruebas confirmaron que la implementación actual es estable. Sí es una diferencia de comportamiento respecto a BrainAural.

## Cambio recomendado si se busca compatibilidad conceptual

Sin copiar código de BrainAural, Cortex podría implementar una versión propia con esta arquitectura:

```text
ruido aleatorio
  → fuentes L/R
  → filtros bandpass centrados en carrier
  → modulación de frecuencia del filtro con f-mod
  → ruta de modulación estéreo/binaural/a-mod
  → mezcla controlada noise ↔ senoide
  → masterGain
```

El cambio debería incluir:

- decisiones explícitas sobre la mezcla `noise = 0..100%`;
- compatibilidad con los canales izquierdo y derecho;
- actualización del filtro al mover `carrier`;
- pruebas de que `f-mod` modifica también la ruta de ruido;
- snapshots/espectro o análisis WAV que distingan ruido directo de ruido filtrado;
- escucha humana posterior, porque una forma de onda válida no demuestra que el resultado sea perceptualmente equivalente.

No se debe copiar literalmente el JavaScript de BrainAural; la referencia sirve para comparar comportamiento y diseño de señal.

## Estado de la investigación

La investigación dio lugar al cambio OpenSpec `cortex-modulated-noise-carrier`. La ruta de ruido filtrada/modulada ya fue implementada de forma independiente en `cortex.html` y validada con pruebas automatizadas. Todavía falta la escucha humana para confirmar que la textura se percibe mejor que el ruido de fondo anterior. La nueva ruta tampoco debe describirse como HRTF ni como equivalente completo a BrainAural.
