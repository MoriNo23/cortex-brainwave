# Spec Delta: desktop-workspace-ux

## MODIFIED Requirements

### Requirement: Las acciones principales tienen atajo de teclado seguro
The system SHALL provide keyboard shortcuts for start/stop, pause, previous/next step and fold/unfold of the timeline, each also reachable through a visible control.

#### Scenario: Atajo de iniciar y detener
- **GIVEN** focus is not in a text input, select, textarea or dialog
- **WHEN** the user presses Space
- **THEN** playback starts or stops as the transport button would

#### Scenario: Atajo de pausa
- **GIVEN** playback is active and focus is not in an interactive control
- **WHEN** the user presses `P`
- **THEN** the whole transport pauses — audio and sequence — and the visible status reflects `pausado` immediately
- **AND** pressing `P` again resumes from the exact paused position

#### Scenario: Atajo ignorado al escribir
- **GIVEN** focus is in a text input
- **WHEN** the user presses Space or a letter shortcut
- **THEN** the character is typed and no transport action occurs

### Requirement: Los controles tienen estados de interacción visibles
The system SHALL show distinct hover, keyboard focus, active and disabled states on every interactive control, and SHALL keep the visual state coherent with the playback state across surfaces.

#### Scenario: Foco de teclado
- **GIVEN** keyboard navigation is in use
- **WHEN** focus lands on a control
- **THEN** the focus state is visible without inspecting the DOM

#### Scenario: Deshabilitado con razón
- **WHEN** an action is unavailable, such as exporting while nothing plays
- **THEN** its control shows a disabled state
- **AND** the reason is discoverable without trying it

#### Scenario: El mapa cerebral sigue al transporte
- **WHEN** playback stops and the transport shows the stopped state
- **THEN** the brain map regions turn off their active illumination, in parity with the radar canvas
- **AND** the last band remains readable in the text panel as session memory

### Requirement: Aplicar un preset actualiza los controles en el mismo tick
The system SHALL apply any preset — builtin or custom — so that state, sliders and readouts are consistent within the same user interaction, without waiting for a later frame.

#### Scenario: Preset personalizado aplicado
- **WHEN** the user clicks a saved custom preset while audio is playing
- **THEN** the brainwave and carrier sliders and their readouts show the preset values in the same tick as the click
- **AND** the audio engine receives those values, not the previous ones

#### Scenario: Preset aplicado con la sesión detenida
- **WHEN** the user clicks a custom preset with playback stopped
- **THEN** the sliders and readouts still show the preset values immediately, ready for the next start
