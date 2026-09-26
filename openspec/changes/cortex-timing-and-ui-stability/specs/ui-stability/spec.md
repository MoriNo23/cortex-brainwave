# Especificación: estabilidad de la interfaz

## Purpose

Define cómo deben comportarse los readouts numéricos y los visualizadores de Cortex cuando el usuario mueve un control con rapidez: sin saltos de layout, sin trabajo de DOM por evento de entrada y sin animaciones que dependan de la tasa de refresco de la pantalla.

## ADDED Requirements

### Requirement: Los readouts numéricos ocupan un ancho estable
The system SHALL render every numeric readout with tabular figures and a box whose width does not depend on the displayed value, so that changing a value MUST NOT shift the surrounding layout.

#### Scenario: Arrastre rápido de un modulador
- **WHEN** the user drags a modulation slider from one extreme to the other in a single gesture
- **THEN** the readout value updates continuously
- **AND** the width of its container and of the neighbouring label remains unchanged
- **AND** no visible jitter or reflow of the panel is produced

#### Scenario: Cambio de magnitud del valor
- **WHEN** a readout transitions between values with different character counts, such as `0%` and `100%`
- **THEN** the readout occupies the same box before and after the change

### Requirement: Las actualizaciones de UI se coalescen en un frame
The system SHALL perform at most one UI update per animation frame for values that change through continuous input, while the audio state MUST reflect each new value within the same frame in which the update is applied.

#### Scenario: Entrada más rápida que la pantalla
- **WHEN** input events arrive faster than the display refresh rate
- **THEN** no more than one DOM update per frame is performed for the readouts
- **AND** the audio engine receives the latest value without a perceptible lag behind the control

#### Scenario: Escrituras sin cambio de valor
- **WHEN** the same value is applied again
- **THEN** no text content is written to the DOM for that readout

### Requirement: La información de banda solo se recalcula al cambiar de banda
The system SHALL update band name, band range, band description, brain region highlighting and preset highlighting only when the brainwave value crosses a band boundary.

#### Scenario: Movimiento dentro de la misma banda
- **WHEN** the brainwave value changes without crossing a band boundary
- **THEN** band name, range, description and region highlighting are left untouched
- **AND** the numeric readouts still reflect the new value

#### Scenario: Cruce de banda
- **WHEN** the brainwave value crosses into another band
- **THEN** band name, range, description, region highlighting and preset highlighting are updated to the new band

### Requirement: Las animaciones no dependen de la tasa de refresco
The system SHALL derive animation progress from elapsed time and MUST NOT accumulate per-rendered-frame increments, so that the same configuration produces the same apparent speed on displays with different refresh rates.

#### Scenario: Pantallas con refrescos distintos
- **WHEN** the app is displayed on a 60 Hz and on a 120 Hz display with the same brainwave value
- **THEN** the wave animation plays at an equivalent apparent speed in both cases

#### Scenario: Reproducción detenida
- **WHEN** audio is not playing
- **THEN** the wave canvas shows only the idle baseline
- **AND** no accumulated phase is carried into the next playback

### Requirement: El pulso visual no escribe estilos por nodo en cada tick
The system SHALL bound per-tick visual emphasis work to at most one update per frame and MUST NOT write an inline style to every brain region on every animation tick.

#### Scenario: Pulso de regiones durante la reproducción
- **WHEN** audio is playing and the brain regions pulse in sync with the brainwave
- **THEN** the emphasis update is applied at most once per frame
- **AND** the per-frame style writes are not proportional to the number of regions on every tick
