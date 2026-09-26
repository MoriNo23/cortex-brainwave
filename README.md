# Cortex Brainwave Audio

Aplicación HTML autocontenida para experimentar con síntesis Web Audio, visualizaciones Canvas/SVG y varias formas de modulación. No usa React, Vue, Svelte, bundler ni dependencias de producción.

## Ejecutar

```bash
python3 -m http.server 4174 --bind 127.0.0.1
```

Abrir `http://127.0.0.1:4174/cortex.html`. También puede abrirse directamente como archivo HTML en un navegador moderno, aunque un servidor local facilita las pruebas.

## Audio

La ruta `Noise` usa fuentes L/R, filtros bandpass centrados en `Carrier`, crossfade con la senoide y modulación de filtro mediante `f-mod`. Esta implementación se inspira en el comportamiento observable de [BrainAural](https://brainaural.com/) sin copiar su código.

La aplicación no implementa HRTF real ni efectos médicos. Usar volumen bajo y detener la escucha ante molestias.

## Pruebas

Requieren Playwright instalado localmente:

```bash
node tests/noise-carrier.cjs
node tests/wav-e2e.cjs
node tests/browser-matrix.cjs
node tests/snapshots.cjs
```

La matriz actual pasa en Chromium, Firefox y WebKit. La escucha humana continúa siendo necesaria para valorar la textura de ruido y la comodidad subjetiva.

## OpenSpec

Los cambios y decisiones se encuentran en:

- `openspec/changes/cortex-open-source-validation-tooling/`
- `openspec/changes/cortex-modulated-noise-carrier/`

Validar un cambio con:

```bash
npx --yes @fission-ai/openspec@latest validate cortex-modulated-noise-carrier --strict --json
```
