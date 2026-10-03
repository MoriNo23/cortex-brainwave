# stroboscopic-visuals Specification

## Purpose

Define una superficie visual estroboscópica segura por omisión, controlable por el usuario y desacoplada del audio, con modos sincronizado e independiente y presentación integrada, mini-player o fullscreen.

## ADDED Requirements

### Requirement: El estrobo tiene transporte propio y estado apagado por omisión
The system SHALL expose a dedicated stroboscopic player with explicit `play` and `stop` controls, and it MUST start in the off state.

#### Scenario: Estado inicial
- **WHEN** the app loads
- **THEN** the stroboscopic surface is not flashing
- **AND** the user can see how to start it explicitly

#### Scenario: Play y stop
- **WHEN** the user presses the stroboscopic play control
- **THEN** the surface starts flashing using the selected frequency mode
- **WHEN** the user presses stop
- **THEN** the flashing stops without leaving residual animation active

### Requirement: El estrobo soporta frecuencia sincronizada con Brainwave
The system SHALL provide a sync mode in which the flashing frequency follows the current Brainwave value.

#### Scenario: Sync con el control principal
- **WHEN** the strobe is in sync mode and the user changes Brainwave
- **THEN** the flash frequency follows the updated Brainwave value
- **AND** the visible mode indicator reflects that the source is the main Brainwave control

### Requirement: El estrobo soporta frecuencia independiente
The system SHALL provide a custom frequency mode with its own user-editable Hz control, independent from the audio Brainwave value.

#### Scenario: Frecuencia propia
- **WHEN** the strobe is in custom mode and the user sets a new Hz value
- **THEN** the flashing frequency changes to that value within the allowed range
- **AND** the main Brainwave control remains unchanged

### Requirement: El estrobo tiene tres presentaciones
The system SHALL support an integrated view, a compact mini-player view and a fullscreen view for the stroboscopic surface.

#### Scenario: Mini-player
- **WHEN** the user switches the strobe to mini-player mode
- **THEN** the flashing surface remains visible in a compact floating or docked player
- **AND** play/stop stay reachable from that compact mode

#### Scenario: Fullscreen
- **WHEN** the user requests fullscreen mode for the strobe
- **THEN** the app enters fullscreen for the stroboscopic surface
- **AND** the user can exit fullscreen explicitly

### Requirement: La activación del estrobo es deliberada y visible
The system SHALL require explicit user activation for the stroboscopic feature and MUST present a visible caution message before or during its use.

#### Scenario: Sin autoplay
- **WHEN** the user opens the app
- **THEN** no flashing starts automatically
- **AND** the strobe remains off until an explicit play action occurs

#### Scenario: Cautela visible
- **WHEN** the user is about to use the strobe
- **THEN** the UI presents a visible caution message about the visual flashing nature of the feature
- **AND** that message avoids medical claims

### Requirement: El estrobo tiene contrato visual verificable
The system SHALL render the stroboscopic surface through a deterministic visual loop whose frequency source, on/off state and presentation mode can be verified independently from the audio engine.

#### Scenario: Contrato de loop
- **WHEN** the strobe is running
- **THEN** the surface alternates between active and inactive visual states according to the selected frequency source
- **AND** the control state, selected mode and rendered state remain consistent

#### Scenario: Stop limpio
- **WHEN** the strobe stops
- **THEN** the visual loop is cancelled
- **AND** the surface returns to its idle state without continuing to flash off-screen
