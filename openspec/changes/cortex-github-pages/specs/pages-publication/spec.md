# Spec Delta: pages-publication

## Purpose

Define cómo la app autónoma llega al público: la publicación en GitHub Pages es un despliegue que sigue al verde de CI, nunca lo reemplaza, y nunca duplica la fuente de verdad del repo.

## ADDED Requirements

### Requirement: La publicación sigue al verde de CI
The publication workflow SHALL deploy the app to GitHub Pages only after the CI workflow completed successfully on the default branch. A failed CI run MUST NOT produce a deployment, and the site MUST keep serving the last successfully verified version.

#### Scenario: CI verde en main
- **WHEN** the CI workflow completes successfully on `main`
- **THEN** the publication workflow deploys the current `cortex.html`
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
The publication SHALL produce the site's entry file by copying `cortex.html` at deploy time. The repository MUST NOT contain a duplicate `index.html`, and the deployed site MUST NOT require a build step, external libraries, or services beyond the app's documented dependencies.

#### Scenario: Copia en el pipeline
- **WHEN** the publication workflow prepares the site
- **THEN** it copies `cortex.html` as the site's index
- **AND** the copy exists only in the deployment artifact, not in the repository

#### Scenario: La app publicada es la autónoma
- **WHEN** a visitor opens the published site
- **THEN** it behaves as the standalone app: no bundler, no server-side logic
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
