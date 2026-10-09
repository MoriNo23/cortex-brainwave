# cortex-testing Specification

## ADDED Requirements

### Requirement: El core matemático tiene referencia numérica externa
The system SHALL validate its critical mathematical/audio derivations against a Python reference implementation using documented tolerances.

#### Scenario: Comparación de fórmulas base
- **WHEN** the verification pipeline runs
- **THEN** it compares JavaScript outputs against Python reference outputs for band mapping, binaural frequencies, AM/FM derivations, mix/clamps and the stroboscopic timing model
- **AND** each comparison uses explicit tolerances rather than informal inspection

#### Scenario: Divergencia numérica
- **WHEN** a JavaScript derivation drifts beyond its allowed tolerance from the Python reference
- **THEN** verification fails naming the mismatched metric and case
- **AND** the report preserves the expected and actual values for inspection

### Requirement: La referencia Python corre en CI y produce artifacts
The system SHALL execute the numerical reference path in CI and publish its comparison outputs as workflow artifacts.

#### Scenario: Corrida ordinaria
- **WHEN** a pull request or push triggers verification
- **THEN** the CI pipeline installs the required Python packages and runs the numerical reference checks
- **AND** it publishes machine-readable outputs or diffs as artifacts

#### Scenario: Falla de dependencia numérica
- **WHEN** the Python reference dependencies cannot be installed or executed in CI
- **THEN** the job fails explicitly naming the missing dependency or runtime problem
- **AND** the failure is not reported as a successful mathematical validation

### Requirement: El estrobo entra en la verificación numérica
The system SHALL include the stroboscopic frequency model in the numerical reference suite.

#### Scenario: Sync Brainwave
- **WHEN** the strobe is configured in sync mode
- **THEN** the numerical reference confirms that the flash timing matches the Brainwave-derived frequency model

#### Scenario: Custom Hz
- **WHEN** the strobe is configured in custom frequency mode
- **THEN** the numerical reference confirms that the flash timing matches the user-selected Hz value within tolerance
