# Spec Delta: unit-verification

## Purpose

El modelo de verificación después de retirar el e2e: chequeos estáticos, unitarios puros en Node sin navegador, build de Astro y referencia matemática contra Python, todo en CI. La cobertura que era inherente al navegador pasa a verificación humana por protocolo.

## ADDED Requirements

### Requirement: La suite es de unitarios puros, sin navegador
The system SHALL verify behavior through pure Node unit tests that import the real sources with simulated engines and clocks, and SHALL NOT ship any Playwright/browser-driven test.

#### Scenario: Sin Playwright en el repo
- **WHEN** the test suite and `package.json` are inspected
- **THEN** no test file launches a browser engine and no `test:*` script is declared
- **AND** every check runs with `node` alone, without a browser install step in CI

#### Scenario: Lógica con motor simulado
- **WHEN** a unit test exercises timeline scheduling, transitions, WAV export or the noise carrier
- **THEN** it imports the real modules from `src/lib` and simulates the audio engine and the clock
- **AND** the assertions are about the logic, not about rendered pixels

### Requirement: La cobertura valiosa del e2e sobrevive como unitarios
The system SHALL keep unit-level coverage for the behavior that the removed e2e suite used to cover where that behavior is pure logic, listing explicitly what is delegated to human verification instead.

#### Scenario: Portado
- **WHEN** the removed browser suites are reviewed against the unit suite
- **THEN** timeline step scheduling, transition interpolation, WAV export and the noise/carrier relationship are covered by unit tests
- **AND** visual layout, real interaction and cross-engine behavior are declared as human-verification territory in `AGENTS.md`

### Requirement: La referencia matemática contra Python es obligatoria
CI SHALL build the Python math reference (numpy/scipy/sympy) and compare it against the JS implementation on every push, covering bands, binaural, mix gain, strobe phase/envelope, `noiseFilterDepthValue`, scalar interpolation and `strobeRampRatio` across its range, plus edge and invalid inputs.

#### Scenario: Comparación completa
- **WHEN** the math comparison job runs
- **THEN** JS and Python values agree within the published tolerances for every fixture
- **AND** the comparison report is published as a workflow artifact

#### Scenario: Una fórmula nueva sin referencia
- **WHEN** a new pure math function is added to the sources
- **THEN** the math reference grows a Python counterpart and fixtures for it in the same change

### Requirement: La verificación humana queda documentada como protocolo
The system SHALL state in `AGENTS.md` which verification remains human — listening sessions, visual comfort, the strobe floating window on a real desktop — and link the listening protocol.

#### Scenario: Lo que CI no cubre
- **WHEN** an agent reads `AGENTS.md` to know what a green CI run does not prove
- **THEN** the human-only checks are listed with their protocol files
- **AND** no automated check claims to replace them
