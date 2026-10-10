# Spec Delta: final-validation

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: snapshots visuales
**Reason**: la captura y comparación de snapshots requiere un navegador renderizando Canvas; con el e2e retirado, esa vía de verificación desaparece del repo por decisión del usuario (solo unitarios).
**Migration**: la corrección del pintado determinista se mantiene donde ya existía sin navegador —el Worker del estrobo se compara contra la referencia en `tests/strobe-worker.cjs`— y el resto del terreno visual pasa a verificación humana por protocolo, listado en `AGENTS.md`.

### Requirement: matriz de navegadores
**Reason**: la matriz de motores (Chromium/Firefox/WebKit) existe solo para el e2e; sin suite de navegador no hay matriz que reportar.
**Migration**: la honestidad de estados (`PASS`/`FAIL`/`BLOCKED`/`MANUAL`) se conserva en `reporte de gaps` aplicada a la suite unitaria; la experiencia real en cada navegador queda como verificación humana explícita, con la excepción documentada de que la ventana flotante del estrobo depende del soporte Picture-in-Picture de cada navegador y se degrada con aviso.
