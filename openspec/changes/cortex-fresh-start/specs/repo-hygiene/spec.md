# Spec Delta: repo-hygiene

## Purpose

Las reglas del arranque limpio: cómo se mantiene el repo como si fuese iniciado desde cero — qué vive en la raíz, dónde va el conocimiento, qué pasa con el material histórico y cuántas ramas existen.

## ADDED Requirements

### Requirement: La raíz del repo solo contiene lo vivo
The repository root SHALL contain only the living project files: the app, its config, `README.md`, `AGENTS.md`, the listening protocol and the Python requirements for the math reference; legacy reports, investigation notes and experiment folders SHALL NOT live in the repo.

#### Scenario: Raíz inspeccionada
- **WHEN** the repository root is listed
- **THEN** no `*-report.md`, investigation log or conversation transcript appears
- **AND** every remaining file is either project config, living documentation or the protocol

### Requirement: El legado no se aparca, se elimina con respaldo externo
Legacy material SHALL NOT be parked inside the repository in a `docs/`, `archive/` or equivalent folder; it is consolidated — distilled into the living docs and specs — and removed from the repo, with a backup written outside the working tree before deletion.

#### Scenario: Sin carpetas-parking
- **WHEN** the repo tree is inspected after the cleanup
- **THEN** no folder exists whose purpose is to hold old versions or legacy reports

#### Scenario: Nada se pierde
- **WHEN** legacy files are deleted
- **THEN** a backup of the removed material exists outside the repository first
- **AND** the knowledge still relevant is already distilled into `README.md`, `AGENTS.md` or a live spec

### Requirement: El registro histórico vive en git, no en el árbol
The project SHALL keep its historical record in the git history and in the external backup, not in the working tree: removed material SHALL stay recoverable through them without the tree carrying historical copies.

#### Scenario: Recuperación puntual
- **WHEN** an old report is needed
- **THEN** it is recovered from git history or the external backup, not from the working tree

### Requirement: Una sola rama de largo plazo
The repository SHALL keep `main` as its only long-lived branch; feature branches are deleted once their work reaches `main`.

#### Scenario: Ramas tras una entrega
- **WHEN** a piece of work lands in `main`
- **THEN** its branch is deleted locally and on the remote
- **AND** `git branch -a` shows only `main` plus short-lived work in progress
