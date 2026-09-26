# Especificación: evaluación de tooling open source

## ADDED Requirements

### Requirement: decisión basada en evidencia
La evaluación SHALL separar existencia, licencia, mantenimiento, compatibilidad y adecuación funcional.

#### Scenario: herramienta existente pero archivada
- **WHEN** un repositorio resuelve técnicamente el problema pero está archivado
- **THEN** se clasifica como `REFERENCE-ONLY` o `REJECT`, no como dependencia recomendada por defecto

#### Scenario: licencia no estándar
- **WHEN** una herramienta tiene código público pero una licencia personalizada
- **THEN** se reporta como caveat legal y no se resume simplemente como "MIT/open source"

### Requirement: evaluación subjetiva
La solución SHALL permitir una prueba de escucha controlada y separada del test automático.

#### Scenario: webMUSHRA
- **WHEN** se evalúa webMUSHRA
- **THEN** se comprueba qué métodos soporta, cómo almacena respuestas y qué obligaciones impone su licencia
- **AND** se decide si se usa como harness externo, fork o solo referencia

### Requirement: ruta HRTF
La solución SHALL distinguir lectura de SOFA, obtención de IR y convolución/renderizado.

#### Scenario: libmysofa
- **WHEN** se usa libmysofa o un port WASM
- **THEN** se verifica que se pueden obtener filtros izquierdo/derecho y delays para una posición
- **AND** se implementa o identifica por separado la FIR/convolución y el movimiento de posición

#### Scenario: motor espacial archivado
- **WHEN** se estudia Resonance Audio
- **THEN** se puede aprender de su arquitectura
- **BUT** no se adopta sin revisar estado de mantenimiento y compatibilidad actual

### Requirement: regresión visual
La solución SHALL comparar snapshots con una tolerancia documentada y controlar animaciones.

#### Scenario: Canvas reactivo
- **WHEN** el radar se renderiza en estados deterministas
- **THEN** el sistema captura el Canvas, compara contra un baseline y produce diff/report
- **AND** una diferencia intencional supera el umbral configurado

### Requirement: cross-browser
La matriz SHALL distinguir navegador ejecutado de navegador bloqueado.

#### Scenario: Playwright install
- **WHEN** se ejecuta `npx playwright install chromium firefox webkit`
- **THEN** se prueba cada motor disponible
- **AND** un motor cuyo binario o dependencia no esté disponible queda `BLOCKED` con la causa

### Requirement: auditoría estructural
La auditoría SHALL poder buscar estructura en HTML con JavaScript/CSS embebidos.

#### Scenario: Difftastic
- **WHEN** se comparan dos versiones de Cortex
- **THEN** el diff muestra cambios estructurales en HTML, JS y CSS sin depender de formato

#### Scenario: ast-grep
- **WHEN** se buscan contratos como `state.stereo`, `drawRadarFrame` o conexiones Web Audio
- **THEN** se pueden crear consultas estructurales y reportar coincidencias sin depender de texto literal completo

### Requirement: adopción reversible
Ninguna herramienta SHALL convertirse en dependencia de producción durante la fase de evaluación.

#### Scenario: spike HRTF
- **WHEN** se prueba un renderer HRTF
- **THEN** vive en una página o módulo aislado, con benchmark y fallback, hasta una decisión explícita
