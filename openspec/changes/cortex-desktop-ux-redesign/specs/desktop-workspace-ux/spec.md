# Especificación: espacio de trabajo de escritorio

## Purpose

Define la interfaz principal como un espacio de trabajo pensado para escritorio: layout sin scroll de página, jerarquía por tareas, sistema de diseño coherente, atajos de teclado y estados de interacción claros.

## ADDED Requirements

### Requirement: El layout entra en pantallas de escritorio sin scroll de página
The system SHALL render the main interface without page-level scrolling at 1366×768, 1920×1080 and 2560×1080, keeping the transport, the timeline dock and the status bar visible.

#### Scenario: Pantalla mínima
- **WHEN** the viewport is 1366×768
- **THEN** the page does not scroll vertically or horizontally
- **AND** the transport, timeline dock and status bar are fully visible

#### Scenario: Pantalla grande
- **WHEN** the viewport is 1920×1080 or 2560×1080
- **THEN** the extra space goes to the visual area and the timeline
- **AND** the controls are not stretched beyond a usable width

### Requirement: La interfaz se organiza por tareas
The system SHALL group controls into transport and session, sound shaping (brainwave, carrier, modulators) and output (volume, gentle stop), with the timeline always reachable without opening a modal.

#### Scenario: Volumen separado del sonido
- **WHEN** the user looks for the output level
- **THEN** it is found in the output group, apart from the brainwave, carrier and modulator controls

#### Scenario: Timeline accesible
- **WHEN** the app loads
- **THEN** the timeline toggle is visible in the main chrome and not inside the preset tools

### Requirement: El estilo sale de un sistema de tokens
The system SHALL define color, typography, spacing, radius and state styles as design tokens in a single place, and SHALL NOT use inline styles to express interaction state.

#### Scenario: Sin estilos inline de estado
- **WHEN** the markup of the interface is inspected
- **THEN** no element toggles its state through a `style` attribute

#### Scenario: Acento por banda conservado
- **WHEN** a clip or readout refers to a band
- **THEN** it uses the band accent token

### Requirement: Las acciones principales tienen atajo de teclado seguro
The system SHALL provide keyboard shortcuts for start/stop, pause, previous/next step and fold/unfold of the timeline, each also reachable through a visible control.

#### Scenario: Atajo de iniciar y detener
- **GIVEN** focus is not in a text input, select, textarea or dialog
- **WHEN** the user presses Space
- **THEN** playback starts or stops as the transport button would

#### Scenario: Atajo ignorado al escribir
- **GIVEN** focus is in a text input
- **WHEN** the user presses Space or a letter shortcut
- **THEN** the character is typed and no transport action occurs

### Requirement: Los controles tienen estados de interacción visibles
The system SHALL show distinct hover, keyboard focus, active and disabled states on every interactive control.

#### Scenario: Foco de teclado
- **WHEN** the user tabs through the interface
- **THEN** every focused control shows a visible focus indicator

### Requirement: El rediseño conserva el contrato funcional
The system SHALL keep every DOM id the application script requires, or migrate it together with its tests, and SHALL keep the interface usable below 900 px without optimizing it.

#### Scenario: Ids requeridos
- **WHEN** the static `dom-references` check runs
- **THEN** every id requested by the script exists in the markup

#### Scenario: Ancho reducido
- **WHEN** the viewport is narrower than 900 px
- **THEN** all primary actions remain reachable
