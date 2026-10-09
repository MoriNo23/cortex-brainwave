# Especificación: integridad del volumen y la portadora

## Purpose

El volumen de salida (`mix`) y la portadora (`carrier`) que eligió el usuario no se alteran de forma involuntaria por la reproducción del timeline, sus transiciones ni el stop suave, ni por datos persistidos con valores inválidos.

## ADDED Requirements

### Requirement: Un paso del timeline no modifica el volumen de salida
The system SHALL NOT change the user's output level (`mix`) when a timeline step is applied or when a transition between steps is interpolated.

#### Scenario: Paso builtin con volumen del usuario
- **GIVEN** the user set the output level to 80
- **WHEN** the timeline plays a sequence of built-in presets
- **THEN** the output level remains 80 at every step and during every transition
- **AND** the master gain of the audio engine remains consistent with that level

#### Scenario: Volumen en cero elegido por el usuario
- **GIVEN** the user set the output level to 0
- **WHEN** the timeline plays
- **THEN** the output level remains 0 and no step raises it

### Requirement: Los presets builtin no fabrican valores en cero
The system SHALL leave `carrier` and `mix` untouched when applying a built-in preset, because built-in presets do not define them.

#### Scenario: Portadora conservada
- **GIVEN** the carrier is 200 Hz
- **WHEN** a built-in preset step is applied
- **THEN** the carrier remains 200 Hz
- **AND** no oscillator frequency is set to 0 Hz

### Requirement: El stop suave restaura el volumen previo del usuario
The system SHALL restore, after a gentle stop, the output level the user had before the timeline or the fade started.

#### Scenario: Detener tras reproducir el timeline
- **GIVEN** the output level was 80 before the timeline started
- **WHEN** the timeline plays and the user then stops playback
- **THEN** after the gentle stop completes the output level is 80
- **AND** starting playback again produces audible output without reloading the page

#### Scenario: Stop con la pestaña oculta
- **WHEN** the user stops playback and the tab becomes hidden before the fade ends
- **THEN** the gentle stop still completes and restores the output level

### Requirement: Los datos persistidos inválidos no corrompen la sesión
The system SHALL interpret stored timeline steps and custom presets safely: a carrier outside 20–1500 Hz SHALL NOT be applied, and a stored `mix` SHALL NOT alter the output level when a step is applied.

#### Scenario: Timeline guardado con el defecto anterior
- **GIVEN** a stored timeline whose steps contain `carrier: 0` and `mix: 0`
- **WHEN** the app loads and the timeline plays
- **THEN** the carrier and the output level keep their live values
- **AND** the stored data is not required to be rewritten

### Requirement: Las rampas del motor parten del valor actual
The system SHOULD anchor each audio parameter ramp at the parameter's current value so that chained ramps do not produce jumps.

#### Scenario: Transición larga
- **WHEN** a transition between two steps runs for several seconds
- **THEN** each parameter progresses monotonically from its source value to its target value without audible discontinuities
