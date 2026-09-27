# Proposal

## Why

El comando local `npm run verify:light` es exactamente la tentación que la política de verificación pretende eliminar. Anunciarlo como puerta de entrada hace que cada invocación de un agente alcance primero un comando local antes de considerar CI, y la máquina donde se trabaja tiene 4 núcleos y 3,8 GB de RAM: una sola corrida con Chromium la dejó con 24,6 % de i/o wait y 6,8 GB de swap. La regla «no abras un navegador» es más fácil de cumplir si en local no hay *ningún* comando de verificación que ejecutar.

Los cuatro chequeos estáticos sí aportan, y son gratis: corren en 8 s dentro del job `ligero` de CI frente a 1 m 45 s de la suite completa. Lo que sobra es el botón local, no el trabajo.

## What Changes

- **Desaparece el comando local `npm run verify:light`** de `package.json`. El proyecto queda sin punto de entrada de verificación local: no hay script en `npm` que lanzar.
- `tests/light/` y sus cuatro chequeos **se conservan**. El job `ligero` de CI los invoca por ruta (`node tests/light/run-light-verify.cjs`), igual que hoy; no cambia la cobertura ni el tiempo de la señal rápida.
- La salida del runner se reorienta a CI: el mensaje que hoy dice «un verde aquí no dice nada sobre la suite con navegador; esa corre en CI» pasa a referirse al propio job, porque el runner ya no se ejecuta en local.
- `AGENTS.md` se reescribe con una sola regla: **toda verificación va por CI**. Se elimina el orden de escalamiento de tres niveles y el «antes de proponer un navegador, corre el nivel ligero», porque ya no hay nivel ligero local que correr. Se conserva y se refuerza la prohibición de levantar un motor sin petición explícita.
- `openspec/config.yaml`: la guía de `apply` deja de dirigir al agente a `npm run verify:light` y pasa a dirigirlo a CI.
- `README.md` y `tests/README.md` dejan de documentar comandos de prueba locales y pasan a explicar que la verificación ocurre en la corrida de CI, con el enlace al workflow y al artifact del reporte.
- Se cierra el PR #1 sin mergear y se borra la carpeta del cambio superseded `cortex-lightweight-verification-policy` junto con su rama, para que no queden dos políticas contradictorias en el repo.
- No hay cambios **BREAKING** en la app: `cortex.html` y `cortex.spec.html` no se tocan, y los scripts de navegador de `tests/` siguen igual.

### Lo que se pierde, dicho explícitamente

Sin comando local, un error de sintaxis o un id huérfano se descubre en CI, no antes del push. El ciclo es más lento para ese primer fallo. A cambio, la máquina de trabajo no se usa para verificar nunca, y el fallo llega con el log del job que lo detectó. Es un intercambio consciente: el tiempo de la primera detección sube, pero los recursos locales bajan a cero.

## Capabilities

### New Capabilities
- `verification-policy`: la verificación del proyecto ocurre íntegramente en integración continua, no hay comando de verificación local, y levantar un navegador en la máquina de trabajo requiere petición explícita.

Esta capability **reemplaza** a la del cambio `cortex-lightweight-verification-policy`, que quedó sin mergear y se borra. `openspec list --specs` no reporta ninguna spec, así que no hay delta que modificar: es una capability nueva en `openspec/specs/`.

### Modified Capabilities
- Ninguna.

## Impact

- `package.json`: se quita el script `verify:light`. Los `test:*` de Playwright **se conservan** —documentan cómo se ejecuta la suite en un entorno con dependencias— pero la política deja de invitarlos a correrlos en local.
- `tests/light/run-light-verify.cjs`: solo cambia el mensaje final, que deja de asumir que corre en local. La lógica, los códigos de salida y el reporte en `artifacts/light-verify.json` no cambian.
- `AGENTS.md`: reescrito. Pasa de tres niveles a una sola regla más las prohibiciones y los límites conocidos.
- `openspec/config.yaml`: la entrada de `operations.apply.guidance` se reescribe.
- `README.md`, `tests/README.md`: los apartados de pruebas pasan a describir CI.
- `.github/workflows/ci.yml`: **sin cambios**. El job `ligero` ya invoca el runner por ruta y no depende del script de npm; ese fue el motivo de invocarlo directamente en vez de con `npm run`.
- Artefactos de OpenSpec: se borra `openspec/changes/cortex-lightweight-verification-policy/` completo.
- GitHub: se cierra el PR #1 y se elimina la rama `cortex-lightweight-verification-policy`; este cambio se abre como PR propio.
- `artifacts/light-verify.json`: se des-versiona y se añade a `.gitignore`, porque pasa a ser un artifact de CI entregado por `upload-artifact` y no un archivo del repo. Es el único cambio de `.gitignore` del proyecto.
