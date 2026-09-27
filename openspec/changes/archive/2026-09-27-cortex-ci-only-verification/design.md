# Design

## Context

Ver `proposal.md` para la motivación. Los hechos del repo que condicionan el diseño:

- `cortex-lightweight-verification-policy` existe como cambio **sin mergear**. Su PR #1 está abierto con los seis jobs en verde. Su carpeta, su rama y su spec de `verification-policy` describen una política que este cambio reemplaza. `openspec list --specs` sigue sin reportar specs, así que la capability nunca llegó a `openspec/specs/`: borrarla del cambio superseded no deja un hueco que rellenar.
- Los cuatro chequeos estáticos viven en `tests/light/` y se invocan por ruta desde el job `ligero` de `ci.yml`, no por `npm run`. Ese desacoplamiento es lo que permite quitar el script de npm sin tocar el workflow.
- `AGENTS.md` está en la raíz y lo lee el agente al arrancar.Hoy describe un orden de escalamiento de tres niveles y cita `npm run verify:light` en tres lugares.
- `openspec/config.yaml` tiene una entrada en `operations.apply.guidance` que hoy dirige al flujo `apply` a `npm run verify:light`. Se comprobó que `openspec instructions apply --json` la devuelve como `operationGuidance`, así que el enlace funciona.
- `artifacts/light-verify.json` está versionado en el repo, y `.gitignore` no lo cubre: las reglas actuales ignoran `artifacts/visual/*.png` pero no los JSON de reporte.
- La máquina de trabajo tiene 4 núcleos y 3,8 GB de RAM, y ya pagó una vez el costo de una corrida con navegador.

## Goals / Non-Goals

**Goals:**

- Cero comandos de verificación ejecutables en la máquina de trabajo.
- Conservar la señal rápida que aporta el job `ligero` (8 s frente a 1 m 45 s de la suite completa).
- Una sola regla, sin niveles: la verificación va por CI.
- Dejar el repo con una sola política, sin restos del cambio superseded.

**Non-Goals:**

- No tocar `ci.yml`. El job `ligero` ya hace lo correcto.
- No modificar la lógica de los cuatro chequeos, sus códigos de salida ni el formato del reporte.
- No tocar `cortex.html` ni `cortex.spec.html`.
- No borrar los scripts `test:*` de Playwright de `package.json`: documentan cómo se ejecuta la suite donde hay dependencias, y borrarlos sería tirar información útil.
- No rediseñar la suite con navegador.

## Decisions

### D1. Se quita el script de npm, no el código

El cambio anterior añadió `verify:light` a `package.json` **y** el job de CI que invoca el runner por ruta. Se quita solo lo primero.

Alternativas consideradas:

- **Borrar `tests/light/` y el job `ligero`**: se descartó porque los cuatro chequeos son los únicos que detectan un error de sintaxis o un id huérfano sin pagar un navegador, y en CI cuestan 8 s. Perderlos sería perder cobertura para nada: el costo que duele ocurre en la máquina, no en el runner.
- **Dejar el script pero marcarlo como solo-CI**: se descartó porque un script en `package.json` es invocable por accidente. La regla sería una convención, no una imposibilidad, que es justo lo que este cambio viene a evitar.
- **Mover los chequeos a `tests/` junto a los de Playwright**: se descartó porque mezclar un conjunto que corre en 8 s sin dependencias con otro que necesita Chromium, y dificultaría decidir qué invocar.

### D2. El runner se invoca por ruta en CI, y su mensaje se reescribe

`ci.yml` ya llama `node tests/light/run-light-verify.cjs`. No hay nada que cambiar en el workflow.

El runner imprime hoy `Nota: un verde aquí no dice nada sobre la suite con navegador; esa corre en CI.` Ese texto asumía que el lector estaba en su máquina. Pasa a hablarse a sí mismo: el verde de los estáticos no es el verde de la suite, y ambos conviven en la misma corrida. Es el único cambio de código del cambio, y es cosmético.

Se conserva la salida por código (`0` todo verde, `1` con fallos, `2` sin chequeos registrados o error inesperado) y el reporte en `artifacts/light-verify.json`, porque el job lo publica con `upload-artifact`.

### D3. `AGENTS.md` se reescribe en vez de editarse

El orden de tres niveles desaparece entero. En su lugar, una regla sola —la verificación va por CI— más lo que ya estaba y sigue siendo cierto: la prohibición de levantar un navegador sin petición explícita, y los límites conocidos de los chequeos.

Se conserva deliberadamente el bloque de límites conocidos, incluida la nota de que `self-contained` no ve el `@import` de Google Fonts. Esa nota es más valiosa ahora que antes: si nadie puede correr los chequeos en local, el único lugar donde se lee es CI y el README.

Se elimina la cláusula «antes de proponer un navegador, haber corrido el nivel ligero», porque no hay nivel ligero local que correr. En su lugar, la condición de escalar pasa a ser declarar qué pregunta queda sin responder.

### D4. `artifacts/light-verify.json` se des-versiona

Pasa a ser un artifact de CI entregado por `upload-artifact`, no un archivo del repo. Versionarlo significaba versionar la salida de una corrida ajena, que además se desactualiza en cada push.

Alternativa considerada: dejarlo versionado, por coherencia con `artifacts/browser-matrix.json` y los JSON de `artifacts/audit/`, que sí están en el repo. Se descarta porque esos se versionan como **evidencia de una revisión concreta** y esta es la salida recurrente de cada push. Se añade a `.gitignore`, que es el único cambio de ese archivo en el proyecto.

### D5. El cambio superseded se borra entero, incluido su PR

La política «ligero por omisión» y la política «todo por CI» son contradictorias. Dejar las dos carpetas en `openspec/changes/` haría que un agente que lea los cambios en vuelo encontrara dos reglas incompatibles sin forma de saber cuál manda.

Se borra la carpeta, se cierra el PR #1 sin mergear y se elimina la rama. El trabajo no se pierde: los cuatro chequeos sobreviven en `tests/light/`, y las lecciones del cambio anterior —los dos bugs encontrados al verificar, la excepción de Google Fonts— quedan registradas en `design.md` de este cambio y en `AGENTS.md`.

## Risks / Trade-offs

- **El primer fallo ahora se descubre en CI, no antes del push** → Aceptado. El ciclo de detección del primer error se alarga en minutos. A cambio, la máquina de trabajo no se usa para verificar nunca, y el error llega con el log del job que lo detectó, que dice archivo y línea. Quien quiera una señal antes de pushear puede pedir una corrida local; solo tiene que pedirla.
- **Perder la señal rápida si alguien mergea el cambio equivocado**: si `AGENTS.md` vuelve a mencionar un comando local y ese comando existe, la policy se erosiona. Mitigación: el escenario de la spec exige que ni `package.json` ni la documentación ofrezcan comando local, así que la regresión es verificable leyendo el repo, sin correr nada.
- **Los chequeos estáticos envejecen sin que nadie los note en local**, porque ya no se ejecutan en la máquina → Mitigación: corren en cada push, así que un checker que se rompe por un cambio de estilo falla en el PR siguiente. El riesgo real es que se adapte mal y dé un verde vacío; el contraste de conteos de `scenario-runner-shape` y el `ok: false` con detalle vacío de `dom-references` son las dos defensas que ya están en el código.
- **El job `ligero` depende de que nadie quite el runner de `tests/light/`** → Mitigación: un escenario de la spec exige que el job invoque el runner por ruta y no por `npm`, y que quitar el script no pueda romperlo. Si alguien borra el runner, el job falla ruidosamente en vez de dar verde.
- **Cerrar el PR #1 sin mergear pierde los comentarios y la revisión que ya tuviera** → Aceptado: el PR está abierto y sin revisión. Su única ventaja frente a este es que acumula varios push; nada de eso se pierde como conocimiento.

## Migration Plan

1. Reescribir `AGENTS.md` y la guía de `config.yaml` con la regla de CI.
2. Quitar el script `verify:light` de `package.json` y des-versionar `artifacts/light-verify.json`, añadiéndolo a `.gitignore`.
3. Reorientar el mensaje del runner.
4. Actualizar `README.md` y `tests/README.md` para que describan CI.
5. Validar en local que el workflow sigue siendo coherente **leyendo el YAML**, sin ejecutar jobs: comprobar que el job `ligero` invoca el runner por ruta y que no referencia el script de npm.
6. Cerrar el PR #1 sin mergear, borrar la rama `cortex-lightweight-verification-policy` y la carpeta del cambio superseded.
7. Abrir el PR propio y confirmar que los seis jobs pasan, con `ligero` ejecutando los cuatro chequeos desde la ruta.

Rollback: revertir el commit. No hay migraciones de datos ni cambios en la app. El cambio más delicado de deshacer es el borrado de la carpeta superseded, que es lo único no recuperable desde este commit; queda en el reflog de git y en el PR #1 cerrado.

## Open Questions

Ninguna. Las tres decisiones que fijaban el alcance —qué desaparece, qué pasa con el PR #1 abierto y qué ocurre con la política escrita— quedaron resueltas con el usuario antes de escribir este documento.
