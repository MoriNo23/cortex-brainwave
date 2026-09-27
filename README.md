# Cortex Brainwave Audio

![CI](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml/badge.svg)

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

**La verificación ocurre en la integración continua.** El proyecto no expone ningún comando de
prueba local, y no hay que añadir uno: se hace el push o se abre el PR, y el resultado se lee
en la corrida.

[`.github/workflows/ci.yml`](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml)
corre cuatro jobs en cada push y en cada pull request:

| Job | Qué corre |
|---|---|
| `ligero` | Cuatro chequeos estáticos sobre los archivos del repo, por ruta y sin instalar navegador |
| `suite` | La suite completa en Chromium |
| `motores` | Timeline y UI en Chromium, Firefox y WebKit |
| `matriz` | `browser-matrix.cjs` con ciclo de vida de audio y exportación WAV |

El job `ligero` es la señal rápida: análisis estático, sin ejecutar la app. Comprueba la
sintaxis del JavaScript inline, que la app siga siendo autónoma, que los ids que el script pide
existan en el markup, y que cada entrada del arreglo `TESTS` de `cortex.spec.html` declare
`group`, `name` y `fn`. Su reporte se descarga del artifact `light-verify` de la corrida.

Un verde de `ligero` **no es** el verde de la suite con navegador: son jobs distintos de la
misma corrida, y un fallo de comportamiento aparece en `suite`, `motores` o `matriz`.

Un fallo se descubre en CI y no antes del push. Es un intercambio consciente: el primer error
tarda unos minutos más en aparecer, a cambio de que la máquina de trabajo no se use para
verificar nunca.

Tres límites conocidos, documentados en `cortex-stability-report.md` y `AGENTS.md`:

- En CI, Firefox no puede correr los escenarios de timeline: un runner headless no tiene dispositivo de audio y su `AudioContext` queda suspendido. Los tests lo omiten con un mensaje explícito en vez de dar un verde vacío.
- Ninguna prueba automatizada reproduce el estrangulamiento real de temporizadores del navegador; la suite simula el retraso de los timers de la página.
- `self-contained` no ve las fuentes web: `cortex.html:8` hace `@import` de Google Fonts. Es una dependencia remota conocida; sin red la app degrada a fuentes del sistema, no se rompe.

### Los scripts `test:*`

`package.json` sigue declarando `npm test` y los `test:*` de Playwright, que documentan cómo se
ejecuta la suite en un entorno con dependencias instaladas. Ya no son el camino de verificación
y no se invocan por omisión:

```bash
npm install                # Playwright y sus motores
npm run serve              # servidor en 127.0.0.1:4173
npm test                   # suite in-page (cortex.spec.html)
npm run test:timeline      # programación temporal sobre el reloj de audio
npm run test:ui            # estabilidad de UI ante interacción rápida
npm run test:matrix        # matriz Chromium/Firefox/WebKit
```

Los tests que soportan varios motores aceptan `ENGINE`:

```bash
ENGINE=firefox node tests/timeline-scheduling.cjs
```

Levantar un navegador en la máquina de trabajo requiere pedirlo explícitamente.

La escucha humana sigue siendo necesaria: protocolo en `cortex-listening-protocol.md` y la prueba de la línea de tiempo con la ventana minimizada, ambas pendientes de hacer con auriculares a volumen bajo.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en `openspec/config.yaml` y los cambios en vuelo en `openspec/changes/`.

```bash
npx --yes @fission-ai/openspec@latest list
npx --yes @fission-ai/openspec@latest validate <cambio> --strict --json
```

Reportes de verificación: `cortex-test-report.md` y `cortex-stability-report.md`.
