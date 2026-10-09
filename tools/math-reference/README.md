# Math reference

Infraestructura para contrastar derivaciones JS contra una referencia Python.

## Piezas

- `fixtures.json`: casos de referencia.
- `tolerances.json`: tolerancias explícitas por magnitud.
- `reference.py`: salida esperada en Python usando `numpy`, `scipy` y `sympy`.
- `compare.mjs`: salida equivalente del lado JS usando `src/lib/core-math.js`, y comparador PASS/FAIL cuando se le entrega un JSON Python.
- `requirements-math.txt`: dependencias Python pensadas para CI.

## Objetivo

Esta carpeta implementa la ruta de verificación numérica pedida en el cambio
`cortex-astro-redesign-strobe`.

## Integración actual en CI

El workflow:

1. instala dependencias Python desde `requirements-math.txt`;
2. genera `artifacts/math-reference-python.json` con `reference.py`;
3. genera `artifacts/math-reference-js.json` con `compare.mjs` en modo referencia JS;
4. compara ambas salidas y escribe `artifacts/math-reference-compare.json`;
5. publica esos archivos como artifacts del job.

Esto mantiene la política del repo: la verificación formal vive en CI y no introduce un
ritual local obligatorio por defecto.
