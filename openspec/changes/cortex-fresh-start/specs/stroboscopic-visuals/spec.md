# Spec Delta: stroboscopic-visuals

## Purpose

Define la superficie estroboscópica rehecha desde cero: una **única** ventana flotante que sigue visible aunque el navegador quede minimizado, apagada por omisión, con modos sync/custom y sin la dupla de mini-reproductores del diseño anterior. El delta previo (en el cambio en vuelo `cortex-astro-redesign-strobe`) nunca se archivó; este lo sustituye.

## ADDED Requirements

### Requirement: El estrobo está apagado por omisión y se activa de forma explícita
The system SHALL expose a stroboscopic player that starts in the off state, with explicit start and stop controls, and MUST NOT flash without an explicit user action.

#### Scenario: Estado inicial
- **WHEN** the app loads
- **THEN** no stroboscopic surface is flashing
- **AND** the way to start it is visible and explicit

#### Scenario: Activación y parada
- **WHEN** the user presses the stroboscopic start control
- **THEN** the flashing starts at the selected frequency mode
- **WHEN** the user presses stop
- **THEN** the flashing stops without residual animation anywhere

### Requirement: El estrobo vive en una única ventana flotante
The system SHALL present the flashing in exactly one floating surface — a Document Picture-in-Picture window where the browser provides it, or a video Picture-in-Picture window otherwise — and SHALL NOT offer a second, in-page mini-player fallback.

#### Scenario: Ventana única
- **WHEN** the strobe is started
- **THEN** there is exactly one flashing surface, the floating window
- **AND** no other surface flashes in the page at the same time

#### Scenario: Visible con el navegador minimizado
- **GIVEN** the floating window is open and flashing
- **WHEN** the user switches tab or minimizes the browser
- **THEN** the floating window keeps flashing on its own OS window

#### Scenario: Navegador sin PiP
- **WHEN** the browser provides no form of Picture-in-Picture
- **THEN** the app states that the floating window is unavailable, with the integrated full-area view as the only flashing surface
- **AND** no fake mini-player animation is rendered in its place

#### Scenario: Cierre de la ventana
- **WHEN** the floating window is closed, from the app or from the window itself
- **THEN** the strobe returns to the main document or stops cleanly
- **AND** no orphaned flashing surface survives outside the document

### Requirement: La ventana flotante es autónoma
The system SHALL keep start/stop, the frequency mode and the Hz readout usable from inside the floating window, reflecting live state without returning to the main tab.

#### Scenario: Controles en la ventana
- **WHEN** the strobe lives in the floating window
- **THEN** play/stop stay reachable inside it
- **AND** the frequency mode and Hz readout reflect the live audio state

#### Scenario: Cambio de frecuencia desde fuera
- **GIVEN** the strobe is in sync mode and the floating window is open
- **WHEN** the user changes Brainwave in the main tab
- **THEN** the floating window's flash frequency follows the new value

### Requirement: El estrobo soporta frecuencia sincronizada e independiente
The system SHALL provide a sync mode that follows the current Brainwave value and a custom mode with its own editable Hz value within 0.5–40 Hz, independent of the audio.

#### Scenario: Sync con el control principal
- **WHEN** the strobe is in sync mode and Brainwave changes
- **THEN** the flash frequency follows the updated value
- **AND** the mode indicator shows Brainwave as the source

#### Scenario: Frecuencia propia
- **WHEN** the strobe is in custom mode and the user sets a new Hz value
- **THEN** the flashing changes to that value within the allowed range
- **AND** the Brainwave control remains unchanged

### Requirement: El flash es seguro y avisa
The system SHALL flash with the soft envelope defined by the math reference, keep the visual flashing warning next to the strobe controls, and keep the clamp of 0.5–40 Hz.

#### Scenario: Aviso persistente
- **WHEN** the strobe UI is visible
- **THEN** the flashing warning is visible with it, in the main panel and inside the floating window

#### Scenario: Fuera de rango
- **WHEN** a custom frequency outside 0.5–40 Hz is requested
- **THEN** the effective flash frequency is clamped into the range
