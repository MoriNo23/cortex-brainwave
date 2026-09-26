# Spike aislado SOFA/HRTF

Este spike define una frontera experimental fuera de `cortex.html`. No se integra en el runtime, no cambia el grafo Web Audio de la app y no afirma que Cortex tenga HRTF.

## Componentes evaluados

| Componente | Rol | Estado del spike |
|---|---|---|
| libmysofa | lector C de archivos AES SOFA | `SPIKE`, no instalado en producción |
| libmysofa-wasm | port WASM para leer/interpolar SOFA en navegador | `SPIKE`, requiere validar build, empaquetado y licencia del port |
| Omnitone | renderer espacial binaural Web Audio | `SPIKE`, evaluar de forma aislada; no asumir mantenimiento activo |

Fuentes: <https://github.com/hoene/libmysofa>, <https://github.com/ColumbiaCEAL/libmysofa-wasm> y <https://github.com/GoogleChrome/omnitone>.

## Límite técnico

Leer/interpolar una respuesta impulsional desde SOFA no es todavía renderizar HRTF. El spike debe demostrar, por separado:

1. selección de una posición y medición de metadatos SOFA;
2. extracción de IR izquierda/derecha;
3. aplicación de delays y filtros FIR/convolución en un grafo de audio;
4. comparación auditiva controlada frente a una condición sin HRTF;
5. comportamiento con auriculares reales y documentación de la cabeza/posición asumidas.

El port `libmysofa-wasm` documenta que obtener IRs todavía requiere aplicar delays y filtrado FIR; por eso no se cuenta la lectura de un SOFA como HRTF reproducido.

## Criterio de salida

No promover a producción salvo que exista un renderer reproducible, una licencia aprobada, mantenimiento suficiente, pruebas con archivos SOFA conocidos y una evaluación humana separada. Una forma de onda válida, `StereoPannerNode`, una separación estéreo o un snapshot visual no satisfacen este criterio.

## Ejecución

`node spikes/hrtf-sofa/probe.cjs` genera `artifacts/hrtf-sofa-probe.json`. El resultado esperado en este workspace es `NOT_EXECUTED`: la app no trae un parser/renderer SOFA y el spike debe permanecer explícitamente aislado.
