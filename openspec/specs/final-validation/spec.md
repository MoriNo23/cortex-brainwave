# final-validation Specification

## Purpose

Define las validaciones finales del producto: la exportación WAV verificable como lógica pura en Node, la coherencia de canales sobre el buffer exportado, y la validación subjetiva y de hardware que es manual por naturaleza y se registra como observación, nunca como evidencia médica. Los snapshots visuales y la matriz de navegadores se retiraron con el e2e: son territorio humano con protocolo.

## Requirements

### Requirement: exportación WAV verificable
La suite de unitarios SHALL validar la exportación WAV como lógica pura: el buffer generado por el módulo de exportación, decodificado en Node sin navegador.

#### Scenario: exportación válida
- **WHEN** se invoca la exportación `.wav` con una configuración válida
- **THEN** el buffer producido es un RIFF/WAVE legible
- **AND** el header declara canales, sample rate y bits consistentes
- **AND** la duración declarada coincide con la solicitada dentro de una tolerancia documentada

#### Scenario: señal no vacía
- **WHEN** se decodifican las muestras del WAV exportado
- **THEN** no contienen `NaN`/`Infinity`
- **AND** la señal no es completamente silenciosa cuando hay una fuente activa
- **AND** el clipping se reporta si supera el umbral definido

### Requirement: coherencia de canales
La suite de unitarios SHALL comprobar sobre el buffer exportado que la configuración de salida conserva la separación esperada.

#### Scenario: binaural
- **WHEN** binaural está activo
- **THEN** los canales izquierdo y derecho del buffer exportado no son idénticos
- **AND** la diferencia de frecuencia declarada se puede observar en el análisis de muestras o se reporta como limitación del método

#### Scenario: mono o sin modulación
- **WHEN** no existe una modulación que requiera separación
- **THEN** la suite no exige artificialmente una diferencia entre canales

### Requirement: validación subjetiva y hardware
La validación auditiva SHALL ser manual y explícita.

#### Scenario: escucha controlada
- **WHEN** una persona prueba la app con auriculares o parlantes identificados
- **THEN** registra navegador, dispositivo, volumen seguro, configuración, sensación izquierda/derecha, presencia de artefactos y comentarios
- **AND** el resultado se etiqueta como observación subjetiva, no como prueba de HRTF

#### Scenario: ausencia de hardware
- **WHEN** el agente no tiene acceso a la salida física del usuario
- **THEN** la prueba queda pendiente y se entrega un protocolo reproducible

### Requirement: reporte de gaps
El reporte SHALL separar `PASS`, `FAIL`, `BLOCKED` y `MANUAL/PENDING`.

#### Scenario: cierre de ronda
- **WHEN** finaliza la ronda de validaciones
- **THEN** cada gap del reporte anterior tiene un estado y evidencia asociada
