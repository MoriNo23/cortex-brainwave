# webMUSHRA — harness externo de escucha

Este directorio no se carga desde `cortex.html` y no añade una dependencia de producción. Es el punto de preparación para una evaluación subjetiva separada con webMUSHRA.

## Decisión

- Clasificación: `SPIKE`.
- Uso: escuchar y comparar estímulos renderizados por separado; no reemplaza Playwright ni los snapshots.
- Estado: protocolo y configuración preparados; la ejecución queda pendiente de revisión legal de la licencia personalizada de webMUSHRA.
- No se deben redistribuir archivos del repositorio de webMUSHRA ni copiar su código dentro de la aplicación antes de aprobar esa revisión.

## Reproducibilidad propuesta

1. Clonar una versión revisada de `https://github.com/audiolabs/webMUSHRA` en un checkout externo y registrar commit, fecha y hash.
2. Servir ese checkout desde un servidor local; no importar el harness en `cortex.html`.
3. Generar los estímulos de Cortex en archivos WAV con `tests/wav-e2e.cjs` y conservar sus hashes SHA-256.
4. Cargar `experiment-config.json` y aplicar `protocol.md`.
5. Registrar navegador, versión, salida, auriculares/parlantes, volumen, orden aleatorio, respuestas y abandonos.
6. Guardar los resultados fuera del repositorio de la app si contienen datos de participantes.

## Alcance y límites

webMUSHRA puede presentar comparaciones subjetivas, pero una respuesta humana no prueba por sí sola que exista HRTF, posicionamiento frente/atrás, exactitud espacial ni un beneficio terapéutico. La salida actual de Cortex debe describirse como síntesis Web Audio y panoramización; cualquier conclusión HRTF exige un renderer SOFA/HRTF explícito y pruebas auditivas separadas.

## Licencia

La fuente consultada contiene una licencia propia titulada “Software License for the webMUSHRA.js Software”, con condiciones de redistribución y una advertencia relacionada con patentes. No se clasifica como MIT ni como licencia OSI sin una revisión jurídica. Fuente: <https://github.com/audiolabs/webMUSHRA/blob/master/LICENSE.txt>.
