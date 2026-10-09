# astro-app-shell Specification

## Purpose

Define la migración del shell principal de Cortex a Astro, con rediseño completo, separación entre presentación y núcleo audiovisual, y una estructura mantenible para las superficies interactivas del reproductor.

## ADDED Requirements

### Requirement: La app principal corre sobre un shell Astro
The system SHALL provide the main application through an Astro app shell with a page entry point, composable layouts and interactive client-side islands for browser-only features.

#### Scenario: Carga de la app principal
- **WHEN** the user opens the main route
- **THEN** the application shell is served by Astro
- **AND** the interactive audio and visual modules hydrate on the client
- **AND** no server-side execution is required for Web Audio or Canvas behavior

#### Scenario: Módulos browser-only
- **WHEN** a feature depends on `window`, `AudioContext`, Canvas, `localStorage` or Fullscreen API
- **THEN** that feature runs only on the client side
- **AND** the shell avoids SSR assumptions for it

### Requirement: El shell separa presentación y core audiovisual
The system SHALL isolate visual composition from the mathematical and audio core, so UI components consume pure derivations and explicit state instead of embedding numeric rules inline.

#### Scenario: Derivación reutilizable
- **WHEN** a component needs a band name, a binaural target or a readout value
- **THEN** it reads that value from a shared core function or store
- **AND** the same derivation can be reused by verification code without DOM access

#### Scenario: Re-render de UI
- **WHEN** the layout or theme changes
- **THEN** the audio core does not need to be rewritten
- **AND** browser-only engines remain isolated behind explicit boundaries

### Requirement: El rediseño reorganiza la app por superficies claras
The system SHALL present the player as distinct surfaces for transport, controls, timeline and visual modules, with a responsive hierarchy suited to a full redesign rather than a direct port of the legacy HTML.

#### Scenario: Jerarquía visual principal
- **WHEN** the user opens the app on desktop
- **THEN** the transport, control surfaces, timeline and main visual areas are visually distinct
- **AND** the stroboscopic player is represented as its own module rather than a hidden toggle

#### Scenario: Responsive
- **WHEN** the viewport narrows
- **THEN** the Astro layout adapts without horizontal page overflow
- **AND** the key playback controls remain reachable

### Requirement: La migración protege la paridad funcional
The system SHALL preserve the functional capabilities already present in Cortex before the legacy shell is retired.

#### Scenario: Paridad mínima
- **WHEN** the legacy shell is considered removable
- **THEN** the Astro shell already supports the main playback flow, persistence, timeline behavior and visual feedback required by the app
- **AND** CI reports those capabilities green in the migrated surface

#### Scenario: Coexistencia temporal
- **WHEN** parity is not yet complete
- **THEN** the repository may keep a temporary legacy path or reference surface
- **BUT** the new shell remains the target architecture of the change
