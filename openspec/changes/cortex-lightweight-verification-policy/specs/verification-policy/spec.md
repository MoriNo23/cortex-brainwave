# Especificación: política de verificación

## Purpose

Define el nivel de verificación que el proyecto usa por omisión, qué comprueba ese nivel sin necesidad de un navegador, bajo qué condición se permite levantar un motor, y qué verificación queda delegada a la integración continua como fuente de verdad de la suite completa.

## ADDED Requirements

### Requirement: La verificación por omisión es ligera y no lanza navegador
The system SHALL provide a default verification tier that runs on Node alone, without launching any browser engine, without downloading dependencies, and without requiring the local HTTP server, and that tier SHALL be the documented entry point for routine work.

#### Scenario: El nivel ligero se ejecuta sin dependencias instaladas
- **WHEN** the lightweight tier is invoked on a clean checkout where `node_modules` is absent
- **THEN** it completes using only the Node runtime
- **AND** it does not install packages or download a browser engine
- **AND** it does not require the port 4173 server to be running

#### Scenario: El nivel ligero no lanza ningún motor
- **WHEN** the lightweight tier runs
- **THEN** no Chromium, Firefox or WebKit process is started
- **AND** the command reports a non-zero exit status if any check fails

#### Scenario: Es la puerta de entrada documentada
- **WHEN** a contributor or an agent looks for how to verify a change
- **THEN** the project documentation names the lightweight tier as the default
- **AND** the browser-based scripts are documented as an explicit, heavier option

### Requirement: El nivel ligero comprueba la integridad estática de la app
The lightweight tier SHALL verify, by reading repository files without executing them in a browser, that the inline JavaScript of `cortex.html` and `cortex.spec.html` parses, that the application remains self-contained, that DOM identifiers referenced by the inline script exist in the markup, and that the in-page scenario runner keeps a statically analysable shape.

#### Scenario: JavaScript inline inválido
- **WHEN** the inline script of `cortex.html` or `cortex.spec.html` contains a syntax error
- **THEN** the lightweight tier fails
- **AND** it identifies which file and which inline block is invalid

#### Scenario: La app deja de ser autónoma
- **WHEN** `cortex.html` gains an external `<script src>`, an external `<link href>`, or a `fetch`/`XMLHttpRequest` call to a remote origin
- **THEN** the lightweight tier fails
- **AND** the failure states that the single-file app is no longer self-contained

#### Scenario: Identificador del DOM inexistente
- **WHEN** the inline script of `cortex.html` requests an element identifier that the markup does not declare
- **THEN** the lightweight tier fails
- **AND** it lists the dangling identifiers

#### Scenario: Runner de escenarios mal formado
- **WHEN** an entry of the `TESTS` array in `cortex.spec.html` is missing its `group`, `name` or `fn` field
- **THEN** the lightweight tier fails
- **AND** it reports the total number of entries it parsed and the position of the malformed one

### Requirement: El nivel ligero se mantiene sin dependencias externas
The lightweight tier SHALL run entirely on the Node runtime and the standard library, with no third-party package and no network fetch on its default path, so that its cost stays a small fraction of a browser run.

#### Scenario: Auditorías estáticas externas no se ejecutan por omisión
- **WHEN** the lightweight tier runs
- **THEN** no `npx` resolution, no difftastic binary and no other network download is triggered
- **AND** the optional static audits remain available as explicitly invoked extras

#### Scenario: Salida legible y reporte
- **WHEN** the lightweight tier finishes
- **THEN** it prints one line per check with pass or fail
- **AND** it writes a machine-readable JSON report under `artifacts/`

### Requirement: La suite con navegador se delega a la integración continua
The project SHALL run the browser-based suite in CI, and the lightweight tier SHALL additionally run on every push in a dedicated job that installs no browser engine, so that a fast signal exists without a local browser.

#### Scenario: La suite completa sigue en CI
- **WHEN** a change is pushed or a pull request is opened
- **THEN** the existing Chromium suite, the multi-engine timeline and UI job, and the browser matrix job run as before
- **AND** the lightweight job runs alongside them and reports independently

#### Scenario: La señal rápida no paga el coste del navegador
- **WHEN** the lightweight job runs in CI
- **THEN** it installs no browser engine
- **AND** it publishes its JSON report as a workflow artifact

#### Scenario: Fallo local no se confunde con cobertura
- **WHEN** the lightweight tier passes locally
- **THEN** passing it is not reported as proof that the browser suite passed
- **AND** the browser suite result is obtained from its CI run

### Requirement: Levantar un navegador requiere petición explícita
An agent or contributor SHALL NOT start a browser engine to verify a change unless the user explicitly asks for a browser run, and before proposing one the lightweight tier SHALL have been run and the browser suite SHALL have been delegated to CI.

#### Scenario: Verificación ordinaria sin navegador
- **WHEN** a change needs verification and the user has not asked for a browser run
- **THEN** the lightweight tier is used
- **AND** the browser suite is left to CI
- **AND** no browser engine is launched

#### Scenario: Petición explícita de navegador
- **WHEN** the user explicitly asks for a browser run, such as a visual or cross-engine check
- **THEN** exactly one browser run scoped to the requested check is performed
- **AND** the run is reported together with its resource cost

#### Scenario: Agotamiento del nivel ligero antes de escalar
- **WHEN** an agent considers proposing a browser run
- **THEN** it has already run the lightweight tier and states why it cannot answer the question
- **AND** it does not propose a browser run to re-confirm what the lightweight tier already proves

### Requirement: La política está escrita donde el agente la lee
The project SHALL state the verification policy in `AGENTS.md` at the repository root, and SHALL reference it from the OpenSpec project configuration so that spec-driven workflows inherit it.

#### Scenario: La regla es legible por el agente
- **WHEN** an agent starts working in the repository
- **THEN** the escalation order is stated in `AGENTS.md`: lightweight tier, then CI, then browser on explicit request
- **AND** the known limits of each level are stated next to it

#### Scenario: Los flujos de OpenSpec heredan la regla
- **WHEN** an OpenSpec apply or archive workflow runs
- **THEN** the project configuration points to the same policy
- **AND** the apply phase verifies with the lightweight tier by default
