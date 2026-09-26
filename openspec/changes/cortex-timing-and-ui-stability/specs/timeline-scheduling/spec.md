# Especificación: programación temporal del timeline

## Purpose

Define el contrato temporal de la reproducción del timeline: el reloj del contexto de audio es la fuente de verdad, las transiciones de paso ocurren aunque la página no se esté renderizando y las operaciones de pausa, reanudación y edición de duración no introducen deriva.

## ADDED Requirements

### Requirement: La progresión del timeline se guía con el reloj de audio
The system SHALL use the audio context clock as the timing source for step progression and MUST NOT decide when a step ends from wall-clock timers.

#### Scenario: Pestaña oculta o ventana minimizada
- **WHEN** the browser tab is hidden or the browser window is minimized during playback
- **THEN** every step transition still occurs while the document is hidden
- **AND** the audio configuration of the next step is applied
- **AND** the lateness of a page callback does not accumulate into the following steps

#### Scenario: Estrangulamiento de temporizadores
- **WHEN** the browser delays or throttles page callbacks while the document is hidden
- **THEN** step boundaries are computed from the audio clock, so the lateness of a step is bounded by the catch-up interval instead of growing step after step
- **AND** no step is skipped, replayed out of order, or applied twice
- **AND** when several step boundaries elapse while hidden, only the resulting current step is applied

### Requirement: La reproducción continúa sin renderizado
Audio and step progression SHALL continue while the document is hidden, and the playback status text, current step highlight and remaining time are best-effort UI that is refreshed when the document becomes visible again.

#### Scenario: Regreso a la pestaña
- **WHEN** the document becomes visible after being hidden during playback
- **THEN** the status text, the current step highlight and the remaining time reflect the actual playback position
- **AND** no stale value from before hiding is shown

#### Scenario: Varios límites de paso durante el ocultamiento
- **WHEN** the document stays hidden across several step boundaries
- **THEN** each step is applied exactly once
- **AND** no additional audio source is created

### Requirement: Pausa y reanudación conservan el tiempo restante exacto
The system SHALL compute remaining step time from the audio clock, so that pausing and resuming does not accumulate drift, and duration edits SHALL be rescheduled from the audio clock.

#### Scenario: Pausa en medio de un paso
- **WHEN** the user pauses during a step and later resumes
- **THEN** the same step is applied for exactly the time that remained at the moment of pausing
- **AND** repeated pause and resume cycles do not shorten or extend the step

#### Scenario: Edición de la duración durante la reproducción
- **WHEN** the user changes the duration of the step that is currently playing
- **THEN** the step is rescheduled from the audio clock
- **AND** the remaining time is not silently raised to a one second floor

### Requirement: Loop y finalización son deterministas
Loop SHALL restart from the first step when the last step ends, and playback SHALL stop after the last step when loop is disabled, regardless of the visibility state of the document.

#### Scenario: Loop en segundo plano
- **WHEN** loop is enabled and the last step ends while the document is hidden
- **THEN** the first step is applied again at its scheduled time

#### Scenario: Finalización
- **WHEN** loop is disabled and the last step ends
- **THEN** playback stops
- **AND** the status reports completion

### Requirement: El estado observable del reproductor se conserva
The system SHALL expose playback state as running, paused, current step index and remaining time through the app's test surface, preserving the existing meaning of each field.

#### Scenario: Verificación existente
- **WHEN** the playback state is read after play, pause or stop
- **THEN** running, paused and the current index report the actual playback state

#### Scenario: Limpieza al detener
- **WHEN** playback is stopped
- **THEN** no pending scheduling remains that could apply a step later
- **AND** a subsequent play does not apply a step twice
