# Proposal

## Why

La verificación es hoy la operación más cara del proyecto y ocurre por omisión. Los catorce scripts de `tests/` importan Playwright, así que `npm test` no tiene alternativa: lanza Chromium. Medido en esta máquina (4 núcleos, 3,8 GB de RAM), esa corrida dejó Chromium en ~69 % de CPU, 24,6 % de i/o wait y 6,8 GB de swap ocupados con 99 MB de RAM libre — el sistema pageando, no la app fallando. Como `node_modules` tampoco está instalado, cada verificación local paga además `npm install` y la descarga del navegador.

La cobertura pesada ya existe y es mejor de lo que se puede replicar localmente: `.github/workflows/ci.yml` corre la suite completa en Chromium, los tests de timeline y UI en los tres motores, y `browser-matrix.cjs` con ciclo de vida de audio y exportación WAV. Lo que falta no es cobertura, es una puerta de entrada barata que no necesite navegador, para que el ciclo normal del agente no pague el coste de un navegador que CI ya le cubre.

## What Changes

- Nuevo nivel de verificación por omisión, **ligero**: `npm run verify:light`, Node puro, sin navegador, sin descargas y sin servidor. Este nivel sostiene el trabajo cotidiano y no puede lanzar un motor por accidente.
- El nivel ligero comprueba, sobre los archivos del repo y sin ejecutarlos en un navegador:
  - Sintaxis del JavaScript inline de `cortex.html` y `cortex.spec.html` extraído y validado con `node --check` (medido: ambos bloques pasan, ~68 ms de CPU en total).
  - Autocontención de la app: cero `<script src>`, `<link href>` o `fetch(`/`XMLHttpRequest` hacia recursos externos, coherente con el HTML autónomo que el README promete.
  - Integridad de referencias del DOM: todo `getElementById()`/`$('#id')` invocado por el script inline debe corresponder a un `id` presente en el HTML (medido hoy: 46 ids usados, 0 huérfanos).
  - Forma del runner de escenarios: el arreglo `TESTS` de `cortex.spec.html` debe seguir siendo analizable estáticamente y cada entrada debe declarar `group`, `name` y `fn` (medido hoy: 79 entradas).
- Las auditorías estáticas existentes en `tools/README.md` (difftastic, ast-grep) quedan como extras opt-in, fuera del nivel ligero obligatorio: el binario de difftastic está gitignorado y ast-grep se resuelve por `npx`, así que ambos introducen descarga de red en el camino por omisión.
- La suite con navegador deja de ser el camino por omisión y queda delegada a CI, que es donde ya se ejecuta en tres jobs. Se añade un job rápido `ligero` que corre `verify:light` en cada push, más un badge de estado en el README.
- La regla se escribe en `AGENTS.md` en la raíz —light por omisión, navegador solo bajo pedido explícito— y se referencia desde `openspec/config.yaml` para que los flujos de OpenSpec la hereden.
- Se corrige la documentación que hoy induce al error: el README y `tests/README.md` presentan los scripts de Playwright como la forma de probar en local.
- No hay cambios **BREAKING**: los scripts de `tests/` siguen existiendo y con el mismo nombre; solo deja de ser la ruta por omisión.

## Capabilities

### New Capabilities
- `verification-policy`: nivel de verificación por omisión del proyecto, qué comprende su nivel ligero, cuándo se permite levantar un navegador, y qué se delega a CI como fuente de verdad de la suite completa.

### Modified Capabilities
- Ninguna. `openspec list --specs` no reporta todavía ninguna spec: las capabilities de timeline y UI siguen en vuelo dentro de sus propios cambios, y este cambio no altera sus requisitos.

## Impact

- `AGENTS.md` (nuevo): la regla de verificación legible por el agente, con el orden de escalamiento (ligero → CI → navegador bajo pedido) y los límites conocidos de cada nivel.
- `openspec/config.yaml`: una línea en `operations.apply.guidance` que referencia la regla, para que `apply` y `archive` la respeten.
- `package.json`: nuevo script `verify:light`; los scripts `test:*` de Playwright se conservan y se marcan como pesados en la documentación.
- `tests/light/` (nuevo): scripts del nivel ligero, con la misma convención de salida por código y escritura de reporte JSON que el resto de `tests/`.
- `.github/workflows/ci.yml`: nuevo job `ligero` sin Chromium; los jobs `suite`, `motores` y `matriz` quedan intactos.
- `README.md` y `tests/README.md`: se separan explícitamente el nivel ligero del nivel con navegador, y se añade el badge de CI.
- No se toca `cortex.html` ni `cortex.spec.html`: este cambio no modifica el comportamiento de la app, solo cómo se verifica.
