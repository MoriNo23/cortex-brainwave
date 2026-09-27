# Design

## Context

- La app es un único HTML autónomo (`cortex.html`, ~100 KB) sin build: publicar es copiar. GitHub Pages requiere un `index.html` en la raíz del sitio para que la URL base sirva algo.
- La verificación ya vive en `.github/workflows/ci.yml` (jobs `ligero`, `suite`, `motores`, `matriz`) y corre en cada push a `main` y en cada PR. La política del proyecto (`AGENTS.md`, spec `verification-policy`) es que el verde lo da CI; nada se verifica en la máquina de trabajo.
- La publicación no es verificación: no debe re-testear, sino observar el resultado del que ya verifica.

## Goals / Non-Goals

**Goals:**

- Una URL pública que siempre sirva la última versión verificada.
- Una sola fuente de verdad: el repo sin `index.html` duplicado.
- Despliegue automático tras el verde, con escape manual documentado.
- Permisos mínimos y sin despliegues concurrentes.

**Non-Goals:**

- Versionado del sitio ( histórico de versiones publicadas), staging, preview de PR.
- Dominio propio, analítica, service worker ni PWA.
- Cambios en la app para "modo sitio publicado": el HTML autónomo ya sirve.

## Decisions

### D1. Despliegue por GitHub Actions, no por rama ni por `/docs`

Alternativas: **(a)** rama `gh-pages` generada — exige un commit de build y mantiene una copia del HTML bajo control de versiones; **(b)** carpeta `/docs` con el HTML duplicado — dos fuentes de verdad que se desincronizan; **(c)** workflow de Actions que arma el artefacto en memoria (elegida). Con **(c)** la copia a `index.html` ocurre en el pipeline y vive solo en el artifact: el repo queda intacto y el despliegue es idempotente.

### D2. Disparo `workflow_run` sobre CI, con `workflow_dispatch` como escotilla

Alternativas: **(a)** disparar en cada push a `main` — publicaría también lo rojo; **(b)** observar el workflow `CI` con `workflow_run` y filtrar `conclusion == 'success'` (elegida); **(c)** encadenar dentro del mismo `ci.yml` — acoplaría verificación y despliegue y oscurecería qué corre en cada corrida. Con **(b)** el sitio solo muestra versiones con verde completo. Costo conocido: `workflow_run` puede no dispararse para la corrida de CI que introduce este archivo (GitHub requiere que el observador exista en la rama por omisión), y siempre se cubre con `workflow_dispatch` para el primer despliegue o cualquier emergencia. El dispatch salta la compuerta a propósito: es un acto explícito del operador.

### D3. Copia cruda + `.nojekyll`

La app no usa assets con guion bajo ni liquid, pero `.nojekyll` es una línea de seguro contra cualquier procesamiento de Pages. El artifact solo contiene `index.html` (la copia) y ese marcador: nada más que copiar, nada más que pueda romperse.

### D4. Permisos mínimos y concurrencia de un solo vuelo

`permissions` restringidas a `contents: read`, `pages: write`, `id-token: write` (lo que exigen `upload-pages-artifact` y `deploy-pages`). `concurrency: github-pages` con `cancel-in-progress`: un push nuevo cuya CI completa reemplaza al despliegue en vuelo — el sitio converge a lo último verde sin encolar.

## Risks / Trade-offs

- **[La habilitación de Pages es un paso de settings fuera del repo]** → El workflow falla visiblemente hasta que se habilita Source: GitHub Actions; documentado en README y como tarea con marcación de acción humana.
- **[`workflow_run` no dispara la primera vez]** → Escape manual con `workflow_dispatch`; documentado.
- **[El artefacto se despliega sin re-verificar]** → Es la decisión, no un riesgo residual: la puerta de calidad es CI completa; re-testear en el job de despliegue duplicaría la verificación y difuminaría qué corre dónde.
- **[Origen de `localStorage` distinto]** → Ajustes, presets y timeline guardados en `127.0.0.1` o en archivo local no aparecen en `morino23.github.io`: son orígenes distintos. Es inherente a la web, no un defecto; se anota en el proposal.
- **[Fuente remota de Google Fonts]** → En Pages pesa igual que en local: dependencia conocida y documentada (`AGENTS.md`), con fallback a fuentes del sistema sin red.

## Migration Plan

1. Push del workflow; CI corre y (al completarse verde) el workflow de Pages aparece en la pestaña Actions.
2. Habilitar una vez Settings → Pages → Source: GitHub Actions.
3. Despachar manualmente la primera publicación si `workflow_run` no disparó; verificar la URL.
4. Rollback: borrar el workflow o deshabilitar Pages en settings; el repo no guardó nada nuevo que revertir (la única huella local es `pages.yml` y la sección del README).

## Open Questions

- Si algún día se quiere preview por PR o dominio propio, se extiende este workflow; nada en esta decisión lo impide ni lo obliga.
