# Spec Delta: transport-pause

## Purpose

La pausa del transporte como contrato de primera clase: audio y secuencia
congelados bajo un único estado visible «pausado», con reanudación sin deriva
y alcanzable por atajo y botón con el mismo efecto.

## ADDED Requirements

### Requirement: Pausar congela audio y secuencia bajo un estado visible
The system SHALL provide a single pause action that freezes both the audio output and the timeline sequence, reflected immediately in the visible transport status.

#### Scenario: Pausa desde el atajo
- **GIVEN** playback is active (audio playing, with or without a running timeline)
- **WHEN** the user presses `P` with focus outside an interactive control
- **THEN** audio output stops producing sound without ending the session
- **AND** the transport status shows `pausado` instead of `reproduciendo`
- **AND** the play button offers resume, not a fresh start

#### Scenario: Pausa desde el botón visible
- **GIVEN** playback is active
- **WHEN** the user clicks the visible pause control of the timeline dock
- **THEN** the effect is identical to the `P` shortcut: audio and sequence frozen, status `pausado`

#### Scenario: Pausa sin timeline en curso
- **GIVEN** audio is playing and no timeline sequence is running
- **WHEN** the user pauses
- **THEN** the audio freezes and the status shows `pausado` — the action is never a silent no-op while sound is playing

### Requirement: Reanudar restaura la posición exacta
The system SHALL resume from the paused state without losing the position of the sequence or the progress of an in-flight transition.

#### Scenario: Reanudar el timeline a mitad de paso
- **GIVEN** the timeline is paused mid-step with a transition partially elapsed
- **WHEN** playback is resumed
- **THEN** the step continues from the remaining time, not from the start
- **AND** the in-flight transition resumes from its remaining ramp
- **AND** the audio clock does not drift relative to the sequence

#### Scenario: Reanudar el audio individual
- **GIVEN** audio is paused with no timeline running
- **WHEN** playback is resumed
- **THEN** the audio continues the same session without rebuilding the graph or restarting oscillators

### Requirement: La pausa es verificable sin navegador
The system SHALL verify the pause contract through pure Node unit tests with a simulated engine and clock, per the project's unit-verification model.

#### Scenario: Contrato cubierto por unitarios
- **WHEN** the unit suite runs in CI
- **THEN** pause/resume is exercised against the real sources with a simulated audio engine
- **AND** the assertions cover the visible status text, the frozen clock and the resume-without-drift behavior
