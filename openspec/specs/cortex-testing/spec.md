# cortex-testing Specification

## Purpose

Define el contrato verificable de la app híbrida (grafo Web Audio, controles reactivos y visualizaciones): la correspondencia control → estado → parámetro, el ciclo de vida del motor, el mapa cerebral, el radar espacial y las animaciones, con límites explícitos entre lo que se prueba con mocks y lo que exige navegador/audio real.

## Requirements

### Requirement: contrato entre controles y estado
La app SHALL mantener una única fuente de verdad para `brainwave`, `carrier`, `amod`, `binaural`, `stereo`, `fmod`, `noise`, `mix` y `playing`.

#### Scenario: cambio de control
- **WHEN** el usuario modifica un slider
- **THEN** el valor visible, `state` y el parámetro o representación dependiente se actualizan sin recargar la página

### Requirement: grafo de audio verificable
La app SHALL exponer comportamientos verificables para la creación, actualización, inicio y detención del grafo Web Audio.

#### Scenario: iniciar
- **WHEN** el usuario inicia una sesión
- **THEN** se crean o activan las fuentes necesarias, incluyendo carrier, fuentes binaurales, fuente stereo, LFOs y ruido

#### Scenario: detener y reiniciar
- **WHEN** el usuario detiene y vuelve a iniciar la sesión
- **THEN** la segunda sesión comienza sin `InvalidStateError`, sin duplicar fuentes audibles y con los parámetros actuales

#### Scenario: frecuencia binaural
- **WHEN** `carrier = C` y `brainwave = B`
- **THEN** la fuente izquierda usa `C` y la derecha usa `C + B`

### Requirement: visual neurológica
El mapa cerebral SHALL reflejar la banda derivada de `brainwave` y limpiar la banda anterior.

#### Scenario: cambio de banda
- **WHEN** `brainwave` cruza 4, 8, 13 o 30 Hz
- **THEN** las regiones activas coinciden con Delta, Theta, Alpha, Beta o Gamma, y las regiones obsoletas se desactivan

### Requirement: radar espacial reactivo
El radar SHALL representar los efectos visuales de cada modulador y actualizarse en cada frame.

#### Scenario: stereo activo
- **WHEN** `stereo > 0`
- **THEN** aparece una cobertura horizontal y el punto fuente puede desplazarse en el eje izquierda-derecha mientras reproduce

#### Scenario: f-mod activo
- **WHEN** `fmod > 0`
- **THEN** aparece una cobertura vertical que representa frente-atrás y el punto fuente puede desplazarse en ese eje mientras reproduce

#### Scenario: binaural activo
- **WHEN** `binaural > 0`
- **THEN** aparecen dos lóbulos simétricos asociados a los oídos

#### Scenario: sin modulación
- **WHEN** `stereo = fmod = binaural = amod = noise = 0`
- **THEN** el radar muestra solamente la geometría base y el readout indica sonido centrado

#### Scenario: detenido
- **WHEN** `playing = false`
- **THEN** no se dibuja un campo dinámico ni un punto fuente animado; el radar queda en estado estático centrado

### Requirement: animaciones seguras
Las animaciones SHALL ejecutarse sin lanzar errores y SHALL distinguir entre reproducción y detención.

#### Scenario: waveform
- **WHEN** la app está detenida
- **THEN** la forma de onda dibuja la línea base
- **WHEN** la app reproduce
- **THEN** dibuja la curva compuesta sin bloquear la UI

### Requirement: persistencia
La app SHALL poder guardar y cargar los ajustes sin modificar `playing` de forma inesperada.

#### Scenario: roundtrip
- **WHEN** se guardan ajustes, se cambian y se cargan
- **THEN** se recuperan los valores guardados y se sincroniza la UI

### Requirement: límites del test
La suite SHALL distinguir explícitamente entre lo que verifica con simulación —motor de audio y reloj falsos sobre los fuentes reales— y lo que queda delegado a la verificación humana, sin declarar nunca que el audio o el navegador reales fueron validados por un test.

#### Scenario: cobertura simulada
- **WHEN** un unitario ejerce el timeline, la exportación WAV o el estrobo
- **THEN** importa los módulos reales de `src/lib` con un motor y un reloj simulados
- **AND** el reporte lo etiqueta como verificación de lógica, no de navegador

#### Scenario: falta de navegador
- **WHEN** no existe un navegador automatizable — que es el estado permanente de la suite
- **THEN** los estáticos y los unitarios constituyen la verificación completa y se ejecutan en CI
- **AND** se informa el gap que queda en territorio humano sin declarar que el audio o el navegador reales fueron validados

#### Scenario: territorio humano
- **WHEN** un comportamiento requiere navegador, audio real o percepción —comfort visual, layout sin scroll, la ventana flotante en un escritorio real, la escucha—
- **THEN** la suite no finge cubrirlo y `AGENTS.md` lo lista como verificación humana con su protocolo
