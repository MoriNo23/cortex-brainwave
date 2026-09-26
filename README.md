# Cortex Brainwave Audio

Aplicación HTML autocontenida para experimentar con síntesis Web Audio, visualizaciones Canvas/SVG y varias formas de modulación. No usa React, Vue, Svelte, bundler ni dependencias de producción.

## Ejecutar

```bash
npm run serve
```

Equivale a `python3 -m http.server 4173 --bind 127.0.0.1`. Después abrir:

- <http://127.0.0.1:4173/cortex.html> — la app
- <http://127.0.0.1:4173/cortex.spec.html> — la suite de escenarios OpenSpec (botón *Correr tests*)

También puede abrirse `cortex.html` como archivo local en un navegador moderno, aunque el servidor local facilita las pruebas.

**Hay que hacer click en `Iniciar` antes de esperar audio.** Los navegadores no liberan el contexto de audio hasta un gesto del usuario; sin ese click la línea de tiempo no puede medir el tiempo y la app lo avisa en vez de fingir que avanza.

## Audio

La ruta `Noise` usa fuentes L/R, filtros bandpass centrados en `Carrier`, crossfade con la senoide y modulación de filtro mediante `f-mod`. Esta implementación se inspira en el comportamiento observable de [BrainAural](https://brainaural.com/) sin copiar su código.

La aplicación no implementa HRTF real ni efectos médicos. Usar volumen bajo y detener la escucha ante molestias.

## Pruebas

Requieren Playwright (`npm install`) y el servidor local levantado en el puerto 4173.

```bash
npm test              # suite in-page (cortex.spec.html)
npm run test:timeline # programación temporal sobre el reloj de audio
npm run test:ui       # estabilidad de UI ante interacción rápida
npm run test:matrix   # matriz Chromium/Firefox/WebKit
```

Los tests que soportan varios motores aceptan `ENGINE`:

```bash
ENGINE=firefox node tests/timeline-scheduling.cjs
```

Todas las corridas se verifican también en CI (`.github/workflows/ci.yml`): suite completa en Chromium, los tests de timeline y UI en los tres motores, y `browser-matrix.cjs` con lifecycle de audio y exportación WAV.

Dos límites conocidos, documentados en `cortex-stability-report.md`:

- En CI, Firefox no puede correr los escenarios de timeline: un runner headless no tiene dispositivo de audio y su `AudioContext` queda suspendido. Los tests lo omiten con un mensaje explícito en vez de dar un verde vacío.
- Ninguna prueba automatizada reproduce el estrangulamiento real de temporizadores del navegador; la suite simula el retraso de los timers de la página.

La escucha humana sigue siendo necesaria: protocolo en `cortex-listening-protocol.md` y la prueba de la línea de tiempo con la ventana minimizada, ambas pendientes de hacer con auriculares a volumen bajo.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en `openspec/config.yaml` y los cambios en vuelo en `openspec/changes/`.

```bash
npx --yes @fission-ai/openspec@latest list
npx --yes @fission-ai/openspec@latest validate <cambio> --strict --json
```

Reportes de verificación: `cortex-test-report.md` y `cortex-stability-report.md`.
