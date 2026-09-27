# Especificación: timeline y presets personalizados

## ADDED Requirements

### Requirement: Timeline accepts an arbitrary ordered sequence
The application MUST allow the user to build an ordered timeline with zero or more preset steps, where each step references a built-in or custom preset and has its own positive duration.

#### Scenario: Add and edit steps
- **WHEN** the user expands the timeline dock and selects presets from the strip
- **THEN** each selection creates a visible clip on the track, proportional to its duration
- **AND** clicking a clip selects it and its duration editor appears in the inspector
- **AND** editing the duration updates the stored step without changing other steps

#### Scenario: Reorder and remove steps
- **WHEN** the user drags a clip, moves it with the inspector buttons, duplicates or removes a timeline step
- **THEN** the visible order and stored order remain identical
- **AND** no removed step is scheduled for playback

### Requirement: Timeline playback can loop indefinitely
The application MUST provide explicit play, pause, stop and loop controls for the timeline.

#### Scenario: Play once
- **WHEN** the user starts a timeline with loop disabled
- **THEN** each step is applied for its configured duration in order
- **AND** playback ends after the last step with a completed/idle status

#### Scenario: Infinite loop
- **WHEN** the user enables loop and starts a non-empty timeline
- **THEN** the first step is applied again after the last step
- **AND** the sequence continues until the user pauses or stops it
- **AND** stopping cancels future scheduled steps

#### Scenario: Empty timeline
- **WHEN** the user tries to play an empty timeline
- **THEN** the app shows an explanatory message
- **AND** it does not create duplicate audio sources or timers

### Requirement: Timeline updates the existing audio lifecycle safely
The timeline MUST apply presets through the existing state/UI/audio update path and MUST NOT call `AudioScheduledSourceNode.start()` more than once for the same source.

#### Scenario: Multi-step audio playback
- **WHEN** a timeline advances from one preset to another while audio is playing
- **THEN** the visible controls and readouts match the active preset
- **AND** the existing AudioEngine remains active
- **AND** the browser reports no page errors

### Requirement: Custom presets capture the current configuration
The application MUST allow the user to create, name, save, edit, use and delete a custom preset containing the complete audio configuration.

#### Scenario: Create custom preset
- **WHEN** the user opens the custom-preset form, enters a name, selects an available emote and saves
- **THEN** the current brainwave, carrier, modulation and mix values are stored
- **AND** the custom preset appears alongside built-in presets and can be inserted into the timeline

#### Scenario: Automatic band identification
- **WHEN** a custom preset is created or its brainwave value is edited
- **THEN** the app calculates its band with the same `bandFromFreq` mapping used by the main UI
- **AND** the detected band is shown below the selected emote
- **AND** the band label is not treated as a medical diagnosis

#### Scenario: Persist custom presets
- **WHEN** the user reloads the standalone HTML app
- **THEN** valid custom presets and the saved timeline are restored from local storage
- **AND** malformed or incompatible data is ignored without a page error

### Requirement: Dock controls are usable without a server or external dependency
The timeline and custom preset UI MUST remain inside the standalone HTML app and MUST provide keyboard-accessible controls. The timeline lives in a permanent bottom dock instead of a modal dialog: no dialog covers the app and no focus trap applies.

#### Scenario: Keyboard behavior
- **WHEN** the user interacts with the dock
- **THEN** every clip, duration, emote and playback control has an accessible label and is reachable by keyboard
- **AND** the drag and resize gestures have keyboard-accessible equivalents (the inspector's move buttons and duration editor)
- **AND** the collapse/expand toggle announces its state with aria-expanded

#### Scenario: Playback without the dock open
- **WHEN** the dock is collapsed
- **THEN** the transport remains visible and the current step and its remaining time are readable without expanding
