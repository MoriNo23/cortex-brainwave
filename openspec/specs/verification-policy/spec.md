# Especificación: política de verificación

## Purpose

Define que la verificación del proyecto ocurre íntegramente en integración continua, que no existe comando de verificación local, y bajo qué condición se permite levantar un motor de navegador en la máquina de trabajo.

## Requirements

### Requirement: No hay comando de verificación local
The project SHALL NOT expose a local verification entry point: no `npm` script, and no documented command, that runs verification checks on the working machine. Verification SHALL be reachable only through a CI run.

#### Scenario: El repositorio no ofrece script de verificación
- **WHEN** a contributor or an agent lists the scripts declared in `package.json`
- **THEN** no script exists whose purpose is to run the lightweight checks locally
- **AND** the browser-based `test:*` scripts remain declared but are not presented as the way to verify a change

#### Scenario: La documentación no ofrece un comando local
- **WHEN** someone reads how to verify a change in `AGENTS.md`, `README.md` or `tests/README.md`
- **THEN** no local verification command is offered
- **AND** the workflow run is named as the place where verification happens

#### Scenario: Un error se detecta en CI, no antes del push
- **WHEN** a change introduces a syntax error or a dangling DOM identifier
- **THEN** the lightweight CI job fails and names the file and the problem
- **AND** nothing on the working machine needed to run for that failure to be found

### Requirement: La verificación ocurre en integración continua
The project SHALL run every verification check in CI, including the lightweight static checks and the browser-based suite, so that no check consumes resources on the working machine.

#### Scenario: Los chequeos estáticos corren en el job ligero
- **WHEN** a change is pushed or a pull request is opened
- **THEN** a dedicated job runs the four static checks by invoking the runner directly, without installing a browser engine
- **AND** it publishes its JSON report as a workflow artifact

#### Scenario: La suite con navegador sigue en sus jobs
- **WHEN** a change is pushed or a pull request is opened
- **THEN** the Chromium suite, the multi-engine timeline and UI job, and the browser matrix job run as before
- **AND** their behaviour is unchanged by the removal of the local command

#### Scenario: El workflow no depende del script de npm
- **WHEN** the lightweight job is inspected
- **THEN** it invokes the runner by file path rather than through an `npm` script
- **AND** removing the `npm` script cannot break the job

#### Scenario: El resultado se consulta en la corrida
- **WHEN** verification is needed for a change
- **THEN** the result is read from the CI run and its artifacts
- **AND** no test is executed on the working machine to obtain it

### Requirement: Levantar un navegador requiere petición explícita
An agent or contributor SHALL NOT start a browser engine on the working machine to verify a change unless the user explicitly asks for a browser run, and an agent SHALL NOT propose one when no question remains unanswered.

#### Scenario: Verificación ordinaria
- **WHEN** a change needs verification and the user has not asked for a browser run
- **THEN** the browser suite is delegated to CI
- **AND** no browser engine is launched on the working machine
- **AND** no local test command is run instead

#### Scenario: Petición explícita de navegador
- **WHEN** the user explicitly asks for a browser run, such as a visual or cross-engine check
- **THEN** exactly one browser run scoped to the requested check is performed
- **AND** the run is reported together with its resource cost

#### Scenario: Nada que escalar
- **WHEN** an agent considers proposing a browser run
- **THEN** it states which question would remain unanswered without it
- **AND** it does not propose a browser run to re-confirm what CI already reports

### Requirement: La política está escrita donde el agente la lee
The project SHALL state the verification policy in `AGENTS.md` at the repository root, and SHALL reference it from the OpenSpec project configuration so that spec-driven workflows inherit it.

#### Scenario: La regla es legible por el agente
- **WHEN** an agent starts working in the repository
- **THEN** `AGENTS.md` states that all verification goes through CI and that no local test command exists
- **AND** it states that a browser on the working machine requires an explicit request
- **AND** the known limits of the checks are stated next to the rule

#### Scenario: Los flujos de OpenSpec heredan la regla
- **WHEN** an OpenSpec apply or archive workflow runs
- **THEN** the project configuration points to the same policy
- **AND** the apply phase delegates verification to CI instead of running a local check
