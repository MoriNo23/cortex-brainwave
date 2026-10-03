# AGENTS.md

Reglas del proyecto para agentes y personas que trabajen en **Cortex Brainwave Audio**.
La app es un HTML autónomo: `cortex.html` no usa bundler ni dependencias de producción.

## Verificación: todo va por CI

**No hay ningún comando de verificación local, y no debe añadirse uno.** No existe script en
`package.json` para correr pruebas, y el proyecto no debe volver a exponerlo.

Cuando un cambio necesite verificación:

1. Se hace el push o se abre el PR.
2. Se lee el resultado en la corrida de CI y sus artifacts.
3. Eso es todo. No se corre nada en la máquina de trabajo para obtener un veredicto.

Un fallo se descubre en CI, no antes del push. Es un intercambio consciente: el primer error
tarda unos minutos más en aparecer, a cambio de que la máquina no se use para verificar nunca.

## Los jobs de CI

`.github/workflows/ci.yml` corre en cada push y en cada pull request:

| Job | Qué corre |
|---|---|
| `ligero` | Los cuatro chequeos estáticos y el Worker del estrobo, por ruta, sin instalar navegador |
| `suite` | La suite completa en Chromium |
| `motores` | Timeline y UI en Chromium, Firefox y WebKit |
| `matriz` | `browser-matrix.cjs` con ciclo de vida de audio y exportación WAV |

El job `ligero` es la señal rápida: análisis estático de archivos, sin ejecutar la app. Cubre:

| Chequeo | Qué detecta |
|---|---|
| `inline-syntax` | Error de sintaxis en el JavaScript inline de `cortex.html` o `cortex.spec.html` |
| `self-contained` | `<script src>`, `<link href>` o `fetch`/`XMLHttpRequest` hacia un origen remoto |
| `dom-references` | Un id que el script pide con `getElementById`/`$('#id')` y el markup no declara |
| `scenario-runner-shape` | Una entrada del arreglo `TESTS` sin `group`, `name` o `fn` |

El mismo job corre además `tests/strobe-worker.cjs`: Node puro, sin navegador y sin
`npm install`. Ejecuta el fuente real del Worker de la ventana flotante en un
contexto `vm` con un `self` y un lienzo simulados, y comprueba que su intensidad y
su pintado (operaciones, estilos y geometría) coinciden con los del hilo
principal. Es la única forma de cubrir ese Worker sin un navegador que no lo
puede abrir en headless. El job `suite` lo repite con dependencias instaladas, y
ahí el chequeo añade la variante **minificada** con esbuild: el bundler renombra
referencias internas y por ahí se cuela un `ReferenceError` que el fuente sin
minificar no muestra.

Un verde de `ligero` **no** es el verde de la suite con navegador: son jobs distintos de la
misma corrida. El reporte de `ligero` se descarga del artifact `light-verify`.

## Navegador local: solo bajo petición explícita

No se levanta un motor por iniciativa propia. Si el usuario **pide explícitamente** una prueba
de navegador (visual, matriz de motores, capturas), se hace **una sola corrida**, acotada a lo
pedido, y se informa de su coste en CPU y memoria.

Antes de proponer un navegador hay que decir **qué pregunta** quedaría sin responder sin él. Si
la respuesta es «ninguna», no se propone. No se abre un navegador para reconfirmar lo que CI ya
reporta, ni aunque el comando exista en `package.json`.

## Límites conocidos

- **`self-contained` no ve las fuentes web.** `cortex.html:8` hace
  `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif…')`. El chequeo
  cubre `<script src>`, `<link href>`, `fetch` y `XMLHttpRequest`, no los `@import` de CSS:
  es una dependencia remota conocida y documentada, no un descuido. Sin red la app no se
  rompe — el stack ya declara fallback (`'Inter', system-ui, sans-serif`) y degrada a
  fuentes del sistema. Autoalojar el subset `latin` costaría ~279 KB en base64 sobre un
  archivo que hoy pesa 103 KB.
- **`inline-syntax` valida sintaxis, no semántica.** Un error de runtime sigue escapando.
- **`dom-references` cubre dos patrones**, `getElementById('x')` y `$('#x')`. No interpreta
  selectores CSS completos, a propósito: los falsos positivos erosionan la señal.
- **Firefox en CI no puede correr los escenarios de timeline.** Un runner headless no tiene
  dispositivo de audio y su `AudioContext` queda suspendido; los tests lo omiten con un
  mensaje explícito en vez de dar un verde vacío. Detalle en `cortex-stability-report.md`.
- **Ningún test automatizado reproduce el estrangulamiento real de temporizadores.** La suite
  simula el retraso de los timers de la página.
- **La escucha humana sigue siendo necesaria.** Protocolo en
  `cortex-listening-protocol.md`, con auriculares y volumen bajo. Ningún job de CI la cubre.
- **Las suites profundas siguen apuntando al legado.** `ui-stability`,
  `timeline-*`, `noise-carrier`, `wav-e2e`, `visual-smoke`, `responsive-smoke`,
  `snapshots`, `browser-matrix` y el runner in-page navegan a `/cortex.html` o
  `/cortex.spec.html`, no a la ruta Astro. Del shell nuevo solo responden
  `astro-shell-smoke.cjs` y `strobe-visuals.cjs`. Es la tarea 8.1 abierta del
  cambio `cortex-astro-redesign-strobe`.
- **Ningún runner headless abre una ventana flotante de verdad.** Document
  Picture-in-Picture necesita un gestor de ventanas. `strobe-visuals.cjs` verifica
  la decisión (o se abre y el panel se muda, o se degrada a mini player con aviso
  y sin errores), no la ventana en sí. Abrirla y mirarla es verificación humana.
- **La ruta de vídeo del PiP (Firefox/Safari) no se cubre en CI.** Se
  autoverifica en runtime: si el `<video>` no entrega fotogramas en 900 ms, se
  cierra y se degrada a mini player con aviso.

## Los scripts `test:*` de `package.json`

`package.json` sigue declarando `npm test` y los `test:*` de Playwright. Ya no son el camino de
verificación y no se invocan por omisión: documentan cómo se ejecuta la suite en un entorno con
dependencias instaladas. No se borran, pero tampoco se ofrecen como opción para verificar un
cambio.

## Auditorías estáticas opcionales

`tools/README.md` documenta dos, fuera del camino por omisión a propósito: difftastic
requiere un binario que está gitignorado, y ast-grep se resuelve por `npx`, que descarga.
Ambas introducen red en cada uso.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en `openspec/config.yaml` y los
cambios en vuelo en `openspec/changes/`. Al implementar un cambio se verifica en CI, igual
que en cualquier otro trabajo: push, leer los jobs, y no correr pruebas en la máquina.
