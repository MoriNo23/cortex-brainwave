# Proposal

## Why

La superficie legado (`cortex.html`, un monolito de ~135 KB) ya no se quiere. Su coste de mantenerla: tres copias idénticas en el repo (`cortex.html`, `public/cortex.html`, `public/cortex-legacy.html`), una suite de escenarios propia (`cortex.spec.html` + `public/cortex.spec.html`) que carga el monolito en un iframe, cuatro chequeos estáticos atados a ese HTML y un despliegue a GitHub Pages que publicaba el monolito. Además duplicaba defectos: el bug del mix (`fix-timeline-mix-reset`) existía idéntico en el legado y era lo que Pages servía.

## What Changes

- **Se elimina** `cortex.html`, `public/cortex.html`, `public/cortex-legacy.html`, `cortex.spec.html`, `public/cortex.spec.html`, `tests/run-cortex-tests.cjs`, `tests/mutation-smoke.cjs` y el enlace "Legado" del header.
- **GitHub Pages publica la build de Astro** (`dist/`), no el monolito. `astro.config.mjs` toma `base` de `PAGES_BASE` (el workflow la fija en `/cortex-brainwave`); en local sigue siendo `/`.
- **Nivel `ligero`**: quedan `dom-references` (ahora recorre `src/` y cuenta como declarados los ids que el JS genera en cadenas de HTML) y `strobe-worker`. Se retiran `inline-syntax`, `self-contained` y `scenario-runner-shape`, que solo aplicaban al HTML autónomo.
- CI deja de esperar `/cortex.html`; se quitan `npm test`, `serve:legacy` y `LEGACY_APP`/`cortexSpecUrl`/`gotoCortexSpec` de los helpers.
- Documentación viva actualizada (`README.md`, `AGENTS.md`, `tests/README.md`). **No se tocan** los informes históricos (`cortex-*-report.md`, `noise-investigation.md`), `spikes/`, `tools/` ni los cambios archivados: describen el estado de su época.

## Capabilities

### Modified Capabilities
- `pages-publication`: la publicación pasa de copiar `cortex.html` a desplegar la build de Astro. Requisitos *"La publicación sigue al verde de CI"* y *"Una sola fuente de verdad"*.

## Impact

- Pérdida consciente de cobertura: la suite in-page de escenarios legados (`TESTS` de `cortex.spec.html`) y la mutación asociada ya no corren. El shell Astro se cubre con `astro-shell-smoke`, `strobe-visuals`, `timeline-*`, `ui-stability`, `noise-carrier`, `wav-e2e`, etc., que ya apuntaban a la ruta raíz por defecto.
- Se pierde la propiedad "HTML autónomo, sin bundler" y con ella el chequeo `self-contained`. Las fuentes de Google siguen siendo una dependencia remota documentada.
- Riesgo principal: Pages sirve bajo `/cortex-brainwave/`; hay que validar `base` con un primer despliegue manual (tarea 2.1).
- Specs vigentes que aún mencionan `cortex.html` (`audio-noise`, `verification-policy`, `final-validation`, `cortex-testing`, `timeline-*`) quedan como deuda: tarea 4.1.
