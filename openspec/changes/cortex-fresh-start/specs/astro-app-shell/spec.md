# Spec Delta: astro-app-shell

## Purpose

Lo esencial del shell Astro, salvado del cambio en vuelo `cortex-astro-redesign-strobe` antes de absorberlo: la shell existe, funciona y ya dio verde en CI; estos requisitos describen lo que ya es cierto y debe seguir siéndolo. El requisito de «rediseño por superficies» de aquel delta queda superado por `desktop-workspace-ux`.

## ADDED Requirements

### Requirement: La app principal corre sobre un shell Astro
The system SHALL provide the main application through an Astro app shell with a page entry point, composable layouts and interactive client-side islands for browser-only features.

#### Scenario: Build y entrada única
- **WHEN** the app is built and served
- **THEN** a single page entry renders the whole application
- **AND** browser-only features run as client islands, not at build time

### Requirement: El shell separa presentación y core audiovisual
The system SHALL isolate visual composition from the mathematical and audio core, so UI components consume pure derivations and explicit state instead of embedding numeric rules inline.

#### Scenario: Reglas numéricas fuera de la UI
- **WHEN** a UI component needs a derived value such as a band name or a gain
- **THEN** it consumes it from the pure math and state modules
- **AND** the component does not re-implement the formula inline

### Requirement: No queda superficie legado
The system SHALL NOT ship any legacy standalone HTML surface; the Astro shell is the only application surface, and the Pages deployment publishes its build.

#### Scenario: Repo sin legado
- **WHEN** the repository is inspected
- **THEN** no standalone legacy HTML entry exists outside the Astro build
- **AND** the published site serves the Astro build only
