# Spec Delta: verification-policy

## MODIFIED Requirements

### Requirement: No hay comando de verificación local
The project SHALL NOT expose a local verification entry point: no `npm` script, and no documented command, that runs verification checks on the working machine. Verification SHALL be reachable only through a CI run.

#### Scenario: El repositorio no ofrece script de verificación
- **WHEN** a contributor or an agent lists the scripts declared in `package.json`
- **THEN** no script exists whose purpose is to run verification checks locally
- **AND** no browser-based `test:*` script remains declared, because the browser suite no longer exists

#### Scenario: La documentación no ofrece un comando local
- **WHEN** someone reads how to verify a change in `AGENTS.md`, `README.md` or `tests/README.md`
- **THEN** no local verification command is offered
- **AND** the workflow run is named as the place where verification happens

#### Scenario: Un error se detecta en CI, no antes del push
- **WHEN** a change introduces a syntax error or a dangling DOM identifier
- **THEN** the lightweight CI job fails and names the file and the problem
- **AND** nothing on the working machine needed to run for that failure to be found

### Requirement: Levantar un navegador requiere petición explícita
An agent or contributor SHALL NOT start a browser engine on the working machine unless the user explicitly asks for a browser run, and an agent SHALL NOT propose one when no question remains unanswered. Automated verification no longer uses a browser at all; a browser appears only for human verification sessions on request.

#### Scenario: Verificación ordinaria
- **WHEN** a change needs verification and the user has not asked for a browser run
- **THEN** verification is delegated to CI
- **AND** no browser engine is launched on the working machine
- **AND** no local test command is run instead

#### Scenario: Petición explícita de navegador
- **WHEN** the user explicitly asks for a browser session, such as a visual or comfort check
- **THEN** exactly one run scoped to the requested check is performed
- **AND** the run is reported together with its resource cost

#### Scenario: Nada que escalar
- **WHEN** an agent considers proposing a browser run
- **THEN** it states which question would remain unanswered without it
- **AND** it does not propose a browser run to re-confirm what CI already reports

## REMOVED Requirements

### Requirement: La verificación ocurre en integración continua
**Reason**: ese requisito prometía que la suite con navegador corre en CI («La suite con navegador sigue en sus jobs»); con el e2e retirado por decisión del usuario, ese escenario es falso y no puede conservarse bajo el mismo nombre.
**Migration**: lo sustituye el requisito ADDED «La verificación ocurre íntegramente en CI, sin navegador», que describe el modelo de dos jobs sin navegador; la regla de fondo (toda verificación en CI, nada en la máquina de trabajo) se conserva íntegra.

## ADDED Requirements

### Requirement: La verificación ocurre íntegramente en CI, sin navegador
The project SHALL run every verification check in CI — static checks, pure Node unit tests, the Astro build and the Python math reference — and no check SHALL depend on a browser engine.

#### Scenario: Los chequeos estáticos corren en el job ligero
- **WHEN** a change is pushed or a pull request is opened
- **THEN** a dedicated job runs the static checks and the unit tests by invoking the runners directly, without installing a browser engine
- **AND** it publishes its JSON report as a workflow artifact

#### Scenario: Build y referencia matemática sin navegador
- **WHEN** a change is pushed or a pull request is opened
- **THEN** another job builds the Astro app and compares the JS math against the Python reference
- **AND** no job installs or launches a browser

#### Scenario: El workflow no depende del script de npm
- **WHEN** the lightweight job is inspected
- **THEN** it invokes the runners by file path rather than through an `npm` script
- **AND** removing any `npm` script cannot break the job

#### Scenario: El resultado se consulta en la corrida
- **WHEN** verification is needed for a change
- **THEN** the result is read from the CI run and its artifacts
- **AND** no test is executed on the working machine to obtain it
