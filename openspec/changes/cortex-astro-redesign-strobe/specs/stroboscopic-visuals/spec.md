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

### Requirement: El estrobo tiene cuatro presentaciones
The system SHALL support an integrated view, a compact mini-player view, a fullscreen view and a floating Picture-in-Picture window for the stroboscopic surface.

#### Scenario: Mini-player
- **WHEN** the user switches the strobe to mini-player mode
- **THEN** the flashing surface remains visible in a compact floating or docked player
- **AND** play/stop stay reachable from that compact mode

#### Scenario: Fullscreen
- **WHEN** the user requests fullscreen mode for the strobe
- **THEN** the app enters fullscreen for the stroboscopic surface
- **AND** the user can exit fullscreen explicitly
- **AND** the whole flashing square stays inside the viewport

### Requirement: El estrobo puede vivir en una ventana flotante que sobrevive al cambio de pestaña
The system SHALL offer a floating window presentation, backed by Picture-in-Picture when the browser provides it, in which the stroboscopic surface keeps flashing while the main tab is hidden or the browser is minimized.

#### Scenario: Ventana flotante disponible
- **WHEN** the user opens the floating window in a browser that supports Picture-in-Picture
- **THEN** the strobe moves to a separate always-on-top window
- **AND** the flashing continues while the main tab is not visible
- **AND** the original panel location shows a visible placeholder explaining where the strobe went

#### Scenario: Controles accesibles desde la ventana flotante
- **WHEN** the strobe is in the floating window
- **THEN** play/stop remain reachable
- **AND** the frequency mode and its Hz readout keep reflecting the live state

#### Scenario: Cierre de la ventana flotante
- **WHEN** the floating window is closed, either from the app or from the window itself
- **THEN** the strobe returns to its place in the main document
- **AND** no stroboscopic surface is left orphaned outside the document

#### Scenario: Navegador sin Picture-in-Picture
- **WHEN** the user opens the floating window in a browser that cannot provide it, or the floating surface fails to produce frames
- **THEN** the app reports why in a visible message
- **AND** it falls back to the mini-player presentation instead of leaving a broken state

### Requirement: La superficie no parpadea fuera de la vista
The stroboscopic surface MUST NOT keep flashing when it is not visible, and MUST NOT stay frozen on a lit frame.

#### Scenario: Pestaña oculta
- **WHEN** the strobe is running and its document becomes hidden
- **THEN** the surface stops flashing and is left in its idle state
- **AND** it resumes with the correct phase when the document is visible again

#### Scenario: Ventana flotante visible con la pestaña oculta
- **WHEN** the strobe lives in the floating window and the main tab is hidden
- **THEN** the floating window keeps flashing, because its own document is the visible one

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

#### Scenario: Envolvente del flash verificada
- **WHEN** the strobe paints a frame
- **THEN** the on/off window follows the duty-0.5 phase contract verified against the Python reference
- **AND** the painted intensity follows a soft attack/release ramp derived from that same phase, so the rendered flash never contradicts the verified frequency
- **AND** any surface that paints the strobe, including one driven from a worker, uses that same verified derivation

#### Scenario: Stop limpio
- **WHEN** the strobe stops
- **THEN** the visual loop is cancelled
- **AND** the surface returns to its idle state without continuing to flash off-screen
