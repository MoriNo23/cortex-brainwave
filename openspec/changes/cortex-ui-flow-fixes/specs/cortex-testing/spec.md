# Spec Delta: cortex-testing

## MODIFIED Requirements

### Requirement: límites del test
La suite SHALL distinguir explícitamente entre lo que verifica con simulación —motor de audio y reloj falsos sobre los fuentes reales— y lo que queda delegado a la verificación humana, sin declarar nunca que el audio o el navegador reales fueron validados por un test.

#### Scenario: cobertura simulada
- **WHEN** un unitario ejerce el timeline, la exportación WAV, el estrobo o la pausa del transporte
- **THEN** importa los módulos reales de `src/lib` con un motor y un reloj simulados
- **AND** el reporte lo etiqueta como verificación de lógica, no de navegador

#### Scenario: falta de navegador
- **WHEN** no existe un navegador automatizable — que es el estado permanente de la suite
- **THEN** los estáticos y los unitarios constituyen la verificación completa y se ejecutan en CI
- **AND** se informa el gap que queda en territorio humano sin declarar que el audio o el navegador reales fueron validados

#### Scenario: territorio humano
- **WHEN** un comportamiento requiere navegador, audio real o percepción —comfort visual, layout sin scroll, la ventana flotante en un escritorio real, la escucha—
- **THEN** la suite no finge cubrirlo y `AGENTS.md` lo lista como verificación humana con su protocolo

#### Scenario: contratos de UI actualizables en unitarios
- **WHEN** un defecto de flujo de UI se confirma en una sesión de navegador (propia o externa)
- **THEN** el contrato afectado se traslada a un unitario con motor simulado en el mismo cambio que el arreglo
- **AND** la sesión de navegador que lo descubrió no se presenta como cobertura permanente
