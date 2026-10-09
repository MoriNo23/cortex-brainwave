# Tasks

> Verificación por CI (`AGENTS.md`); nada se ejecutó en local.

## 1. Retirar el legado
- [x] 1.1 Borrar monolito, copias en `public/`, spec in-page, `run-cortex-tests`, `mutation-smoke` y el enlace del header.
- [x] 1.2 Quitar `npm test`, `serve:legacy`, `LEGACY_APP`, `cortexSpecUrl` y `gotoCortexSpec`.

## 2. Pages sobre Astro
- [x] 2.1 `pages.yml` construye con `PAGES_BASE=/cortex-brainwave` y publica `dist/`.
- [x] 2.2 Lanzar el workflow a mano una vez (`workflow_dispatch`) y comprobar que la página, scripts y estilos cargan bajo `/cortex-brainwave/` sin 404.

## 3. Verificación
- [x] 3.1 `dom-references` recorre `src/`; `ligero` queda con ese chequeo y `strobe-worker`.
- [ ] 3.2 Leer el primer CI: si `dom-references` da falsos positivos (ids generados por JS que el patrón no ve), ampliar `DECLARACIONES` en vez de relajar el chequeo.

## 4. Deuda de specs
- [x] 4.1 Actualizar o archivar los requisitos vigentes que todavía nombran `cortex.html` / `cortex.spec.html`.
