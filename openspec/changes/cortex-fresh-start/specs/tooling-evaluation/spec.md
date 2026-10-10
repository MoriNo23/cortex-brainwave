# Spec Delta: tooling-evaluation

## REMOVED Requirements

### Requirement: regresión visual
**Reason**: la herramienta de regresión visual compara snapshots renderizados en navegador; con el e2e retirado no queda superficie automatizada donde aplicarla, y mantener el requisito invita a reintroducir una dependencia que la política de solo-unitarios retiró.
**Migration**: el pintado determinista que sí es verificable sin navegador (el Worker del estrobo) ya tiene su comparación en `tests/strobe-worker.cjs`; el terreno visual restante pasa a verificación humana por protocolo, listado en `AGENTS.md`.

### Requirement: cross-browser
**Reason**: la matriz de motores era parte del e2e retirado; evaluar herramientas para probar en varios navegadores no corresponde a un repo cuya verificación automatizada no usa navegador.
**Migration**: las diferencias reales entre navegadores que siguen importando —el soporte de Picture-in-Picture del estrobo y el comportamiento de audio ante pestaña oculta— quedan como verificación humana explícita con protocolo, no como requisito de herramienta.
