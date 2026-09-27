# Especificación: validaciones finales de Cortex

## ADDED Requirements

### Requirement: exportación WAV verificable
La suite SHALL validar el archivo WAV descargado por la aplicación.

#### Scenario: exportación válida
- **WHEN** el usuario activa `.wav` con una configuración válida
- **THEN** se descarga un archivo RIFF/WAVE legible
- **AND** el header declara canales, sample rate y bits consistentes
- **AND** la duración declarada coincide con la duración solicitada dentro de una tolerancia documentada

#### Scenario: señal no vacía
- **WHEN** se decodifican las muestras del WAV exportado
- **THEN** no contienen `NaN`/`Infinity`
- **AND** la señal no es completamente silenciosa cuando hay una fuente activa
- **AND** el clipping se reporta si supera el umbral definido

### Requirement: coherencia de canales
La suite SHALL comprobar que la configuración de salida conserva la separación esperada.

#### Scenario: binaural
- **WHEN** binaural está activo
- **THEN** los canales izquierdo y derecho no son idénticos durante toda la sesión
- **AND** la diferencia de frecuencia declarada se puede observar en el análisis o se reporta como limitación del método

#### Scenario: mono o sin modulación
- **WHEN** no existe una modulación que requiera separación
- **THEN** la suite no exige artificialmente una diferencia entre canales

### Requirement: snapshots visuales
La validación SHALL poder comparar representaciones visuales deterministas.

#### Scenario: radar cambia por control
- **WHEN** se renderiza el mismo frame con `stereo=0` y `stereo=80`
- **THEN** los snapshots o una métrica de diferencia de imagen muestran un cambio

#### Scenario: regiones cerebrales
- **WHEN** se renderizan Delta, Alpha y Beta
- **THEN** las regiones activas y el layout esperado aparecen en el snapshot

### Requirement: matriz de navegadores
La suite SHALL reportar el resultado por motor, sin mezclar disponibilidad con fallo.

#### Scenario: motor disponible
- **WHEN** Chromium, Firefox o WebKit está instalado
- **THEN** se ejecutan smoke, WAV y snapshot en ese motor

#### Scenario: motor no disponible
- **WHEN** un motor no está instalado o sus dependencias faltan
- **THEN** se marca `BLOCKED` con la dependencia exacta, no `PASS`

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
