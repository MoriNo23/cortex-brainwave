# timeline-dock Specification

## Purpose

Define el timeline como un dock inferior permanente y plegable estilo editor de video/audio: clips proporcionales a su duración, playhead que sigue el reloj de audio, selección con inspector y gestos con reemplazo accesible. Reemplaza al popup modal.

## Requirements

### Requirement: El timeline es un dock permanente y plegable
The system SHALL render the timeline as a dock that is always visible at the bottom of the app, with a collapsed state showing the transport and a slim progress bar, and an expanded state showing the ruler, the clip track and the preset strip. The dock MUST NOT cover the rest of the interface.

#### Scenario: Estado plegado
- **WHEN** the dock is collapsed
- **THEN** the transport controls remain visible and usable
- **AND** the current step and its remaining time are visible without expanding
- **AND** the rest of the app is fully visible

#### Scenario: Plegar y desplegar
- **WHEN** the user clicks the timeline toggle button
- **THEN** the dock switches between collapsed and expanded
- **AND** the preference persists across reloads

#### Scenario: Sin modal
- **WHEN** the timeline is used
- **THEN** no dialog covers the app and no focus trap applies
- **AND** the controls of the main interface remain reachable

### Requirement: Los clips son proporcionales a su duración
The system SHALL render each step as a horizontal clip whose width is proportional to its duration relative to the total, with band color, emoji, name and a duration chip, and a minimum readable width.

#### Scenario: Proporcionalidad
- **WHEN** the timeline holds steps of 10 s, 20 s and 30 s
- **THEN** the 30 s clip is visibly wider than the 20 s clip, which is wider than the 10 s one
- **AND** the ratios match the durations within the minimum-width tolerance

#### Scenario: Clip corto legible
- **WHEN** a step is much shorter than the others
- **THEN** the clip keeps its minimum readable width
- **AND** its duration chip shows the exact value

### Requirement: El playhead sigue el reloj de audio
The system SHALL move a playhead across the clip track reflecting the real playback position derived from the audio clock, restarting on loop and resynchronizing when the document becomes visible.

#### Scenario: Avance en vivo
- **WHEN** a step is playing
- **THEN** the playhead progresses within that step's clip proportionally to the elapsed time
- **AND** the update does not trigger layout of the whole dock on every frame

#### Scenario: Cruce de paso
- **WHEN** playback moves from one step to the next
- **THEN** the playhead jumps to the start of the next clip

#### Scenario: Al volver de segundo plano
- **WHEN** the document becomes visible after being hidden during playback
- **THEN** the playhead reflects the actual position, not a stale one

### Requirement: Selección con inspector accesible
The system SHALL select a clip on click and expose an inspector with the step name, a duration editor with the s/min unit toggle, and the apply, move, duplicate and remove actions. Double click SHALL apply the preset.

#### Scenario: Seleccionar y editar duración
- **WHEN** the user clicks a clip and edits its duration in the inspector
- **THEN** the stored seconds update within the step limits
- **AND** the clip width reflects the new duration
- **AND** playback of that step, if running, is rescheduled without a one-second floor

#### Scenario: Aplicar por doble click
- **WHEN** the user double clicks a clip
- **THEN** the preset applies immediately with its label

#### Scenario: Acciones del inspector
- **WHEN** the user uses move, duplicate or remove in the inspector
- **THEN** the clip order or count changes accordingly and the stored timeline matches

### Requirement: Gestos de reordenar y redimensionar con reemplazo por teclado
The system SHALL allow reordering a clip by dragging it horizontally and changing its duration by dragging its right edge, with snapping to sensible increments, and MUST provide keyboard-accessible equivalents for both gestures.

#### Scenario: Reordenar arrastrando
- **WHEN** the user drags a clip onto another position and drops it
- **THEN** the step order changes to match the drop
- **AND** the stored order updates

#### Scenario: Redimensionar arrastrando el borde
- **WHEN** the user drags a clip's right edge
- **THEN** the duration changes following the drag with snapping
- **AND** the resulting duration stays within the step limits

#### Scenario: Reemplazo accesible
- **WHEN** the user cannot or does not want to drag
- **THEN** the inspector's move buttons change the order and the duration editor changes the duration

### Requirement: El transporte y la transición viven en el dock
The system SHALL place the play, pause, stop, clear, loop and transition controls in the dock toolbar, preserving the behavior and persistence already specified for loop and transition.

#### Scenario: Transporte en el dock
- **WHEN** the dock is collapsed
- **THEN** the play, pause and stop controls remain available
- **AND** playing a sequence moves the playhead of the slim progress bar

#### Scenario: Transición desde el dock
- **WHEN** the user changes the transition toggle or its duration from the dock toolbar
- **THEN** the running ramp recomputes without restarting the step, as specified in `timeline-transitions`

### Requirement: El dock funciona en la pantalla del usuario y en móvil
The system SHALL keep the app usable at 1366×768 with the dock expanded, and SHALL keep the dock usable below the 900 px breakpoint with a horizontally scrollable track.

#### Scenario: Altura en 1366×768
- **WHEN** the app renders at 1366×768 with the dock expanded
- **THEN** no vertical overflow hides the transport or the status bar
- **AND** the visualizers remain visible

#### Scenario: Ancho estrecho
- **WHEN** the viewport is below 900 px
- **THEN** the clip track scrolls horizontally instead of overflowing the page
