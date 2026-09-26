# Especificación: transiciones del timeline

## Purpose

Define cómo el timeline pasa de un paso al siguiente interpolando el estado de audio, cómo se configura esa transición en vivo y cómo se editan las duraciones en segundos o minutos, todo sobre el reloj del contexto de audio.

## ADDED Requirements

### Requirement: Transición suave configurable entre pasos
The system SHALL provide a global timeline transition setting with an enable switch and a duration in seconds (0 to 60), applied between consecutive steps, and MUST persist it with the timeline.

#### Scenario: Transición activada por omisión
- **WHEN** the timeline is loaded with no stored transition data
- **THEN** the transition is enabled with a default of 2 seconds
- **AND** the toggle and the duration field show those values

#### Scenario: Cambio de paso con transición
- **WHEN** a step starts while the transition is enabled with duration greater than zero
- **THEN** the audio parameters move gradually from the current state to the step preset over the configured seconds
- **AND** the status text marks the ramp with "· transición" while it lasts
- **AND** the final state equals the step preset

#### Scenario: Transición desactivada conserva el corte directo
- **WHEN** a step starts with the transition disabled or set to zero seconds
- **THEN** the step preset is applied directly, as before this change

#### Scenario: Persistencia de la transición
- **WHEN** the app is reloaded after enabling, disabling or editing the transition duration
- **THEN** the stored values are restored, and durations outside 0 to 60 are clamped into range

### Requirement: La interpolación sigue el reloj de audio
The system SHALL drive the interpolation from the audio context clock, so a transition in progress continues with the document hidden and finishes at its scheduled time, without accumulating drift.

#### Scenario: Transición con la pestaña oculta
- **WHEN** a step boundary with a transition occurs while the document is hidden
- **THEN** the audio keeps moving toward the step preset
- **AND** when the document becomes visible the parameters reflect the real progress of the ramp

#### Scenario: Reanudación en medio de una rampa
- **WHEN** the user pauses during a transition and resumes
- **THEN** the ramp continues from the elapsed progress instead of restarting
- **AND** the audio reaches the step preset within the configured duration

### Requirement: La configuración de transición se edita en vivo
The system SHALL allow changing the transition switch and its duration during playback, recomputing the current ramp without restarting the step.

#### Scenario: Editar la duración durante una rampa
- **WHEN** the user changes the transition duration while a ramp is in progress
- **THEN** the ramp is recomputed from the already elapsed step time
- **AND** the step keeps its own scheduled end

#### Scenario: Desactivar durante una rampa
- **WHEN** the user disables the transition while a ramp is in progress
- **THEN** the step preset is applied directly and the ramp ends

### Requirement: Duraciones editables en segundos o minutos
The system SHALL allow editing step durations and the transition duration in seconds or minutes, with a per-context unit toggle, range limits per kind, and a hint of the equivalent in the other unit.

#### Scenario: Cambiar la unidad de un paso
- **WHEN** the user switches the step duration unit from seconds to minutes
- **THEN** the existing value is shown converted, without changing the stored seconds
- **AND** the hint shows the equivalent in the other unit

#### Scenario: Editar en minutos
- **WHEN** the user types a value in minutes for a step
- **THEN** the stored value is the equivalent in seconds within the step limits (1 to 3600)
- **AND** reloading the app preserves the edited duration

#### Scenario: Unidad de la transición
- **WHEN** the transition duration is edited in minutes
- **THEN** the stored value is the equivalent in seconds within the transition limits (0 to 60)

### Requirement: La UI de la rampa pasa por el planificador de frame
The system SHALL apply interpolated UI updates through the per-frame scheduler, so a ramp in progress updates sliders and readouts at most once per animation frame.

#### Scenario: Ramp visible sin thrashing
- **WHEN** a transition is in progress
- **THEN** the sliders and readouts reflect the interpolated values
- **AND** the DOM update work for those values is coalesced into at most one pass per frame
