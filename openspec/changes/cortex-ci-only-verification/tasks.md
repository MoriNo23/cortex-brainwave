# Tasks

## 1. Retirar el comando local

- [x] 1.1 Quitar el script `verify:light` de `package.json` y verificar que `npm run` ya no ofrece ningún script de verificación, con `node -e` listando las claves de `scripts` y comprobando que no hay ninguna que apunte a `tests/light/`
- [x] 1.2 Des-versionar `artifacts/light-verify.json` con `git rm --cached` y añadirlo a `.gitignore`; verificar que `git status` ya no lo reporta como rastreado y que `git check-ignore` lo reconoce
- [x] 1.3 Confirmar que los scripts `test:*` de Playwright siguen declarados en `package.json`; verificar que sus diez entradas siguen presentes, que cada una apunta a un archivo que existe y que ninguna se ha modificado

## 2. Reorientar el runner a CI

- [x] 2.1 Reescribir el mensaje final de `tests/light/run-light-verify.cjs`, que hoy dice «un verde aquí no dice nada sobre la suite con navegador; esa corre en CI», para que hable del propio job en vez de asumir un lector local; verificar con `node tests/light/run-light-verify.cjs` que los cuatro chequeos siguen en verde y que el nuevo texto aparece en la salida
- [x] 2.2 Confirmar que la lógica del runner no cambió: mismo registro de cuatro chequeos, mismos códigos de salida (`0`, `1`, `2`) y mismo reporte en `artifacts/light-verify.json`; verificar con `git diff` que el único cambio en el archivo es la línea del mensaje

## 3. Reescribir la política

- [x] 3.1 Reescribir `AGENTS.md` con una sola regla —toda verificación va por CI, no hay comando local— conservando la prohibición de levantar un navegador sin petición explícita y el bloque completo de límites conocidos, incluida la nota de que `self-contained` no ve el `@import` de Google Fonts; verificar que el archivo ya no menciona `npm run verify:light` en ningún punto
- [x] 3.2 Reescribir la entrada de `operations.apply.guidance` en `openspec/config.yaml` para que apunte a CI en vez de al comando local; verificar que el YAML sigue siendo válido y que `openspec instructions apply --json` devuelve la `operationGuidance` nueva
- [x] 3.3 Actualizar el apartado de pruebas de `README.md` para que describa la verificación en CI y el enlace al workflow, sin ofrecer comando local; verificar que la sección menciona el job `ligero` y que ninguna instrucción presenta un comando local como forma de verificar
- [x] 3.4 Actualizar `tests/README.md` con la misma orientación, manteniendo listados los scripts de Playwright como referencia de cómo se ejecuta la suite en un entorno con dependencias; verificar que los ocho comandos existentes siguen listados y que `light/` se describe como algo que CI invoca por ruta

## 4. Verificar que el workflow sobrevive

- [x] 4.1 Leer `.github/workflows/ci.yml` y confirmar que el job `ligero` invoca `node tests/light/run-light-verify.cjs` por ruta y no por `npm run`; verificar con `grep` que el workflow no contiene `verify:light` en ningún punto
- [x] 4.2 Confirmar que `git diff` no toca `.github/workflows/ci.yml`; verificar que el workflow no aparece entre los archivos modificados del cambio
- [ ] 4.3 Abrir el PR propio y confirmar en la corrida que los seis jobs pasan y que `ligero` ejecuta los cuatro chequeos invocando el runner por ruta; verificar en el log del job que el reporte se publica como artifact

## 5. Cerrar el cambio superseded

- [ ] 5.1 Cerrar el PR #1 sin mergear con una nota que diga que este cambio lo reemplaza; verificar con `gh pr view 1` que el estado es `CLOSED` y que no se mergeó
- [ ] 5.2 Eliminar la rama `cortex-lightweight-verification-policy` local y remota; verificar con `git branch -a` que ya no aparece
- [x] 5.3 Borrar la carpeta `openspec/changes/cortex-lightweight-verification-policy/` completa; verificar con `openspec list` que solo queda `cortex-ci-only-verification` y que el otro cambio ya no aparece
- [x] 5.4 Repasar el repo buscando instrucciones colgadas que invoquen `verify:light`: `grep -rn` sobre `AGENTS.md`, `README.md`, `tests/README.md`, `package.json`, `openspec/config.yaml` y los cambios **distintos de este**; verificar que no queda ninguna coincidencia. Las menciones dentro de los artefactos de `cortex-ci-only-verification` sí se permiten y son esperadas: son el registro histórico de la eliminación
- [x] 5.5 Confirmar que `cortex.html`, `cortex.spec.html` y los catorce scripts de navegador de `tests/` no tienen cambios en todo el cambio; verificar con `git diff --stat` contra el commit base que ninguno aparece, y que nada se borró ni renombró
