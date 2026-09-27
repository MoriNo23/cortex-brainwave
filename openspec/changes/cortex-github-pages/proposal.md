# Proposal

## Why

La app es un HTML autónomo (`cortex.html`) que hoy solo corre en local o en el servidor de pruebas de CI. El usuario quiere una URL pública para usarla y compartirla sin levantar nada: publicarla es copiar un archivo, pero hacerlo a mano duplicaría el archivo o publicaría versiones sin verificar. Registrar la publicación como capability la vuelve parte del contrato del proyecto: el sitio público siempre es la última versión que dio verde en CI.

## What Changes

- Nuevo workflow `.github/workflows/pages.yml` que publica `cortex.html` en GitHub Pages **solo cuando el workflow `CI` completó con éxito en `main`** (disparo `workflow_run`), con `workflow_dispatch` como escotilla manual.
- La "build" es una copia en el pipeline: `cortex.html` → `site/index.html` (+ `.nojekyll`). El repo mantiene una única fuente de verdad; no se añade un `index.html` duplicado.
- El despliegue usa los actions oficiales de Pages con permisos mínimos (`pages: write`, `id-token: write`) y un grupo de `concurrency` que reemplaza el despliegue anterior.
- Se documenta en el README la URL, el requisito único de habilitación (Settings → Pages → Source: GitHub Actions) y que la publicación sigue al verde de CI.
- `cortex.html` no cambia: no hay cambios **BREAKING** ni en la app ni en `cortex-timeline-v1`.

## Capabilities

### New Capabilities

- `pages-publication`: la app se publica en GitHub Pages desde CI, solo tras un verde, con una sola fuente de verdad en el repo.

### Modified Capabilities

- Ninguna. `verification-policy` no cambia: la publicación es un despliegue, no una verificación — el verde lo sigue dando `ci.yml`, que `pages.yml` observa.

## Impact

- `.github/workflows/pages.yml`: archivo nuevo (despliegue; no toca los jobs de verificación).
- `README.md`: sección *GitHub Pages* junto a la tabla de jobs de CI.
- GitHub (una vez, a mano): habilitar Pages con Source: GitHub Actions. El workflow existe, pero GitHub rechaza el despliegue hasta ese cambio de settings.
- Límites conocidos que la publicación hereda de la app: la fuente de Google Fonts sigue siendo remota (documentada en `AGENTS.md`), el audio sigue exigiendo click en Iniciar, y `localStorage` cambia de origen — los ajustes guardados en local o en otro dominio no viajan a `morino23.github.io`.
