# pages-publication Specification

## Purpose

Define cómo la app llega al público: la build de Astro ocurre en el pipeline de GitHub Pages, el artefacto de despliegue es la única copia del sitio, y el despliegue sigue al verde de CI nunca lo reemplaza.

## Requirements

### Requirement: La publicación sigue al verde de CI
The publication workflow SHALL deploy the app to GitHub Pages only after the CI workflow completed successfully on the default branch. A failed CI run MUST NOT produce a deployment, and the site MUST keep serving the last successfully verified version.

#### Scenario: CI verde en main
- **WHEN** the CI workflow completes successfully on `main`
- **THEN** the publication workflow builds the Astro shell and deploys `dist/`
- **AND** the site serves that version

#### Scenario: CI rojo en main
- **WHEN** the CI workflow completes with failures on `main`
- **THEN** no deployment happens
- **AND** the published site remains the last green version

#### Scenario: Lanzamiento manual
- **WHEN** the publication workflow is triggered manually
- **THEN** it deploys without waiting for a CI run
- **AND** the deployment is recorded as manual in the run history

### Requirement: Una sola fuente de verdad
The publication SHALL build the Astro shell at deploy time and publish the result of that build. The repository MUST NOT contain a duplicate built `index.html`, and the built site MUST NOT require a server, external libraries, or services beyond the app's documented dependencies. The build happens only in the pipeline; the repository keeps `src/` as its single source of truth.

#### Scenario: Build en el pipeline
- **WHEN** the publication workflow prepares the site
- **THEN** it runs `npx astro build` with `PAGES_BASE=/cortex-brainwave`
- **AND** it uploads `dist/` as the deployment artifact
- **AND** `dist/` exists only in the artifact, not in the repository

#### Scenario: La app publicada carga bajo el subpath
- **WHEN** a visitor opens the published site under `/cortex-brainwave/`
- **THEN** assets resolve correctly because `base` was set at build time
- **AND** audio still requires a user gesture, as in any browser

### Requirement: El despliegue no tapa al anterior ni escala permisos
The publication workflow SHALL run with the minimum permissions Pages requires and SHALL supersede any in-flight deployment of a previous push instead of accumulating concurrent deployments.

#### Scenario: Push nuevo durante un despliegue
- **WHEN** a new push to `main` completes CI while a previous deployment is still running
- **THEN** the in-flight deployment is superseded by the newer one

#### Scenario: Sin habilitación de Pages
- **WHEN** the repository has not enabled Pages with Source: GitHub Actions
- **THEN** the publication workflow fails visibly in the run history instead of pretending success
- **AND** enabling Pages once in repository settings unblocks subsequent deployments
