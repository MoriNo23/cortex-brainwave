# Tasks

## 1. Nivel ligero: infraestructura

- [x] 1.1 Crear `tests/light/lib/extract-inline-js.cjs` con una función que extraiga los bloques `<script>` inline de un archivo HTML con regex y devuelva `{ file, bloques }`; verificar con `node -e` que sobre `cortex.html` devuelve 1 bloque de 74.579 bytes y sobre `cortex.spec.html` 1 bloque de 41.781 bytes
- [x] 1.2 Crear `tests/light/lib/assert.cjs` con el contrato de resultado `{ id, ok, detalle }` compartido por todos los chequeos; verificar que un módulo de ejemplo que devuelve `ok: false` se serializa a JSON sin campos `undefined`
- [x] 1.3 Crear el runner `tests/light/run-light-verify.cjs` que ejecute todos los chequeos, imprima una línea por chequeo con `PASS`/`FAIL` y escriba `artifacts/light-verify.json`; verificar que con cero chequeos registrados el runner sale con código 2 y un mensaje explícito, sin escribir un reporte verde vacío

## 2. Nivel ligero: chequeos

- [x] 2.1 Implementar `tests/light/checks/inline-syntax.cjs`: extrae el JS inline de `cortex.html` y `cortex.spec.html`, lo escribe con extensión `.mjs` en un temporal y lo valida con `node --check`; verificar que pasa en el estado actual del repo y que falla con un mensaje que nombra el archivo y el número de bloque ante un error de sintaxis introducido temporalmente
- [x] 2.2 Implementar `tests/light/checks/self-contained.cjs`: rechazar `<script src>`, `<link href>` y llamadas `fetch(`/`XMLHttpRequest` con origen remoto en `cortex.html`; verificar que pasa hoy (0 coincidencias) y que falla al añadir temporalmente una etiqueta `<script src="https://example.com/x.js">`
- [x] 2.3 Implementar `tests/light/checks/dom-references.cjs`: recoger los ids declarados en el markup y contrastarlos con los usos de `getElementById('x')` y `$('#x')` del script inline, listando los huérfanos; verificar que pasa hoy (46 ids usados, 0 huérfanos) y que falla al añadir un `getElementById('noExiste')` temporal
- [x] 2.4 Implementar `tests/light/checks/scenario-runner-shape.cjs`: analizar estáticamente el arreglo `TESTS` de `cortex.spec.html`, exigir que cada entrada declare `group`, `name` y `fn`, y reportar el conteo; verificar que pasa hoy (79 entradas) y que falla ante una entrada a la que se le quite `fn`
- [x] 2.5 Registrar los cuatro chequeos en el runner y añadir el script `verify:light` a `package.json`; verificar que `npm run verify:light` pasa en el repo limpio, con `node_modules` ausente, y que no abre ningún proceso de navegador durante la corrida

## 3. Política escrita

- [x] 3.1 Crear `AGENTS.md` en la raíz con el orden de escalamiento (nivel ligero → CI → navegador solo bajo petición explícita), el criterio para pedir un navegador y los límites conocidos de cada nivel; verificar que el archivo nombra `npm run verify:light` y `.github/workflows/ci.yml` como las dos rutas permitidas
- [x] 3.2 Añadir en `openspec/config.yaml` una línea bajo `operations.apply.guidance` que referencie la regla de `AGENTS.md`; verificar que el archivo sigue siendo YAML válido y que `openspec context --json` lo lee sin error
- [x] 3.3 Actualizar el apartado `## Pruebas` de `README.md` para separar el nivel ligero del nivel con navegador, añadir el badge de CI y dejar claro que `npm test` requiere Playwright; verificar que ninguna instrucción del README presenta un script de navegador como el camino por omisión
- [x] 3.4 Actualizar `tests/README.md` con una sección que declare el nivel ligero, su coste medido y el hecho de que no necesita servidor ni dependencias; verificar que los comandos existentes de Playwright siguen listados como opción explícita

## 4. Integración continua

- [x] 4.1 Añadir el job `ligero` a `.github/workflows/ci.yml` con checkout, `setup-node` y `npm run verify:light`, sin paso `playwright install`, y con subida de `artifacts/light-verify.json` como artifact del workflow; verificar que el YAML es válido y que el job no referencia `playwright`
- [x] 4.2 Confirmar que los jobs `suite`, `motores` y `matriz` quedan sin modificar, comparando el diff del workflow contra `HEAD`; verificar que el único cambio en `ci.yml` es el job añadido
- [ ] 4.3 Lanzar un push de prueba y verificar en la corrida que `ligero` termina en verde, que `suite`, `motores` y `matriz` siguen en verde, y que el badge del README refleja el estado real del workflow

## 5. Verificación de cierre

- [ ] 5.1 Ejecutar `npm run verify:light` con el repo en su estado final y confirmar que el reporte `artifacts/light-verify.json` lista los cuatro chequeos en verde
- [ ] 5.2 Medir con `/usr/bin/time -v` el consumo de `npm run verify:light` y contrastarlo con el de un script de navegador; verificar que el nivel ligero queda en el orden de milisegundos y sin memoria significativa, y anotar la cifra medida en el informe del cambio
- [ ] 5.3 Revisar que ningún archivo de `tests/` existente fue modificado o renombrado y que `cortex.html` y `cortex.spec.html` no tienen cambios; verificar con `git status` y `git diff --stat` que el cambio solo toca `AGENTS.md`, `openspec/config.yaml`, `package.json`, `tests/light/`, `tests/README.md`, `README.md` y `.github/workflows/ci.yml`
