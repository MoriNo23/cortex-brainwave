# AGENTS.md

Reglas del proyecto para agentes y personas que trabajen en **Cortex Brainwave Audio**.
La app es un HTML autónomo: `cortex.html` no usa bundler ni dependencias de producción.

## Verificación: orden de escalamiento

Este proyecto tiene tres niveles de verificación. **Se empieza siempre por el primero.**

### 1. Nivel ligero — el camino por omisión

```bash
npm run verify:light
```

Node puro. Sin navegador, sin `npm install`, sin servidor en el 4173. Tarda poco más de un
segundo. Es lo que se ejecuta para cualquier cambio.

Comprueba cuatro cosas, todas por análisis estático de los archivos del repo:

| Chequeo | Qué detecta |
|---|---|
| `inline-syntax` | Error de sintaxis en el JavaScript inline de `cortex.html` o `cortex.spec.html` |
| `self-contained` | `<script src>`, `<link href>` o `fetch`/`XMLHttpRequest` hacia un origen remoto |
| `dom-references` | Un id que el script pide con `getElementById`/`$('#id')` y el markup no declara |
| `scenario-runner-shape` | Una entrada del arreglo `TESTS` sin `group`, `name` o `fn` |

Deja el reporte en `artifacts/light-verify.json`.

**Un verde aquí no dice nada sobre el comportamiento de la app.** No simula audio, ni DOM,
ni reloj de audio. Solo lee archivos. La cobertura real la da la suite con navegador.

### 2. Suite con navegador — en CI, no en local

`.github/workflows/ci.yml` corre en cada push:

- `suite` — la suite completa en Chromium
- `motores` — timeline y UI en Chromium, Firefox y WebKit
- `matriz` — `browser-matrix.cjs` con ciclo de vida de audio y exportación WAV
- `ligero` — el nivel ligero, sin instalar navegador

El resultado de la suite se lee **en la corrida de CI**, no ejecutándola en local.

### 3. Navegador local — solo bajo petición explícita

No se levanta un motor por iniciativa propia. Si el usuario **pide explícitamente** una
prueba de navegador (visual, matriz de motores, capturas), se hace **una sola corrida**,
acotada a lo pedido, y se informa de su coste en CPU y memoria.

Antes de proponer un navegador hay que:

1. Haber corrido `npm run verify:light`.
2. Haber delegado la suite completa a CI.
3. Decir **qué pregunta** queda sin responder y por qué el nivel ligero no la puede contestar.

Si la respuesta es «ninguna», no se propone navegador. No se abre un navegador para
reconfirmar lo que el nivel ligero ya prueba.

## Límites conocidos de cada nivel

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
  `cortex-listening-protocol.md`, con auriculares y volumen bajo.

## Auditorías estáticas opcionales

`tools/README.md` documenta dos, fuera del camino por omisión a propósito: difftastic
requiere un binario que está gitignorado, y ast-grep se resuelve por `npx`, que descarga.
Ambas introducen red en cada uso.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en `openspec/config.yaml` y los
cambios en vuelo en `openspec/changes/`. Al implementar un cambio, se verifica con
`npm run verify:light` y la suite completa se deja a CI, igual que en cualquier otro trabajo.
