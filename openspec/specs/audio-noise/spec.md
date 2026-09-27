# audio-noise Specification

## Purpose

Define el control `Noise` como portadora de ruido filtrada y modulable alrededor del `Carrier`, con la ruta en vivo y la de exportación WAV en acuerdo, el ciclo de vida seguro y la app mantenida como HTML autónomo.

## Requirements

### Requirement: Noise is a filtered carrier
The application MUST route the noise control through a band-pass filter centered on the current carrier frequency instead of connecting raw white noise directly to the master output.

#### Scenario: Noise at zero
- **WHEN** `Noise` is `0%`
- **THEN** the noise blend gain is zero and the base carrier gain remains at its normal level
- **AND** no raw noise source contributes audible output through the base path

#### Scenario: Noise at one hundred
- **WHEN** `Noise` is `100%`
- **THEN** the base sine carrier gain is zero
- **AND** the filtered noise carrier is audible around the selected `Carrier` frequency
- **AND** the output remains finite and below clipping limits

### Requirement: Noise follows carrier and frequency modulation
The application MUST update the two noise filter center frequencies when `Carrier` changes and MUST modulate those center frequencies when `f-mod` is above zero.

#### Scenario: Carrier changes
- **WHEN** the user changes `Carrier` from one audible frequency to another
- **THEN** both noise band-pass center frequencies follow the new carrier value

#### Scenario: Frequency modulation changes
- **WHEN** the user raises `f-mod`
- **THEN** the noise filter modulation depth becomes nonzero
- **AND** the filter center is constrained to valid Web Audio frequency limits

### Requirement: Live and WAV paths agree
The application MUST use equivalent noise filtering, crossfade, carrier tracking and frequency modulation in the live graph and in the WAV `OfflineAudioContext` graph.

#### Scenario: Export filtered noise
- **WHEN** the user exports a WAV with `Noise` above zero
- **THEN** the file is a valid PCM WAV
- **AND** its noise component is filtered around `Carrier` rather than raw full-band white noise

### Requirement: Lifecycle remains safe
The new noise sources and filters MUST participate in the existing start-stop-start lifecycle without attempting to start or stop a source node more than once.

#### Scenario: Restart playback
- **WHEN** the user starts, stops, and starts playback again
- **THEN** playback reaches `reproduciendo`, then `detenido`, then `reproduciendo`
- **AND** the browser reports no page errors

### Requirement: Portable implementation
The change MUST keep Cortex as a standalone HTML app with native Web Audio APIs and MUST NOT add a production framework or runtime package.

#### Scenario: Open the app without a project install
- **WHEN** a user opens `cortex.html` in a modern browser
- **THEN** the noise path is available after the user gesture that starts audio
- **AND** no npm install or backend is required
