# pages-publication Specification

## Purpose

Define cómo la app llega al público: la build de Astro ocurre en el pipeline de GitHub Pages, el artefacto de despliegue es la única copia del sitio, y el despliegue sigue al verde de CI nunca lo reemplaza.

## Requirements

### Requirement: La publicación sigue al verde de CI
The publication workflow SHALL deploy the app to GitHub Pages only after the CI workflow completed successfully on the default branch. A failed CI run MUST NOT produce a deployment, and the site MUST keep serving the last successfully verified version.

#### Scenario: CI verde en main
- **WHEN** the CI workflow completes successfully on `main`
- **THEN** the publication workflow builds the Astro app and deploys the result
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
The publication SHALL build the site from the repository sources at deploy time. The repository MUST NOT contain a built copy of the site, and the build output MUST live only in the deployment artifact.

#### Scenario: Build en el pipeline
- **WHEN** the publication workflow prepares the site
- **THEN** it runs the Astro build with the base path of the Pages project
- **AND** the output exists only in the deployment artifact, not in the repository

#### Scenario: La app publicada carga bajo el subpath
- **WHEN** a visitor opens the published site under `/<repository>/`
- **THEN** the page, its scripts and its styles load without 404 errors
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
