# BackstopJS frente a snapshots nativos

Clasificación: `SPIKE` (comparador aislado), no dependencia de producción ni segundo harness integrado.

## Ejecución reproducible

```bash
npx --yes backstopjs@6.3.25 reference --config=spikes/backstop/backstop.config.js
node tests/native-page-snapshot.cjs
cp artifacts/visual/native-page-desktop.png \
  spikes/backstop/bitmaps_reference/cortex-backstop-native-comparison_cortex-body_0_body_0_desktop.png
npx --yes backstopjs@6.3.25 test --config=spikes/backstop/backstop.config.js
```

El snapshot nativo de Playwright se toma en 1440×900 y el mismo viewport se usa en BackstopJS. El snapshot de referencia se sustituye deliberadamente por la captura nativa para que Backstop compare contra ella, no contra una referencia generada por Backstop.

## Resultado observado

- BackstopJS: `6.3.25`.
- Playwright nativo: captura creada sin errores de página.
- Comparación: mismas dimensiones; diferencia bruta `1.26%` con `misMatchThreshold: 0.1%`.
- El comando termina en `FAIL` porque la aplicación contiene animaciones/estado temporal; esto es evidencia de comparación, no una regresión de producto.
- No se sube `backstopjs` al runtime ni se agrega una segunda suite al CI.

La discrepancia no se interpreta como prueba de HRTF ni como motivo suficiente para duplicar los snapshots nativos. Reconsiderar solo si se necesita un reporte/flujo de aprobación que Playwright no cubra y después de congelar explícitamente el estado animado.
