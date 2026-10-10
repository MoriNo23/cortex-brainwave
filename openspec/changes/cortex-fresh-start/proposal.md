# Proposal

## Why

La migración a Astro está terminada y el CI está verde en `main` (`d82dd2a`, 7 jobs en `success`): los bugs están arreglados. El usuario decidió entonces una pasada de **arranque limpio**: el repo carga con documentación legada, cambios en vuelo ya superados, ramas ya fusionadas y una suite e2e que se sustituye por unitarios; además quedan pendientes el rediseño UI/UX de escritorio, la reinvención del reproductor estroboscópico y la confirmación matemática de los cálculos. Todas esas decisiones son **no negociables** (ver sección final): este cambio las ejecuta, no las reabre.

La revisión matemática pedida («por si acaso») **ya se hizo durante la planificación** y pasó: la referencia Python de CI (`tools/math-reference/`) compara sin fallos, y una verificación independiente de 78 casos —incluidas las fórmulas que la referencia no cubre (`noiseFilterDepthValue`, `interpolateScalar`, `strobeRampRatio`, bordes de banda/mix) y entradas inválidas— coincide con el JS en todos los casos. No hay errores matemáticos que reparar; este cambio solo extiende la referencia permanente a esas fórmulas descubiertas.

## What Changes

1. **Repo desde cero (higiene).** Se consolida el conocimiento útil de la documentación legado en `README.md`, `AGENTS.md` y las specs vivas —destilado, no copiado— y **se elimina** del repo: los 6 informes legado de la raíz (`cortex-dock-report.md`, `cortex-sdd-validation-report.md`, `cortex-stability-report.md`, `cortex-test-report.md`, `cortex-transitions-report.md`, `noise-investigation.md`), el registro de conversación `202609261423-gemini-…-40hz-17msg.txt`, `spikes/`, `openspec/changes/archive/` completo y los zips sin seguimiento de la raíz (`cortex-ramas.zip`, `files.zip`). **Nada de aparcar legado en `docs/` ni en `archive/`**: antes de borrar, todo el material eliminado se respalda **fuera del repositorio** (en el disco local, no en el repo). `cortex-listening-protocol.md` y `requirements-math.txt` se quedan: son vivos.
2. **Rediseño UI/UX de escritorio + comodidades.** Absorbe por completo el cambio en vuelo `cortex-desktop-ux-redesign` (17 de 18 tareas pendientes): espacio de trabajo desktop-first sin scroll en 1366×768→2560×1080, jerarquía por tareas (transporte+sesión / sonido / salida), sistema de tokens propio, atajos de teclado con guardas de foco, estados hover/foco/activo y el timeline como protagonista.
3. **Estrobo rehecho desde cero.** El reproductor estroboscópico se reconstruye: **una única superficie flotante** que se ve aunque el navegador esté minimizado, **adiós al mini-reproductor dual** (la animación en página y la doble vía de «mini»). Se explora la ventana Document Picture-in-Picture (Chromium) y el PiP de vídeo (Firefox/Safari) como vía navegador, y una **build de escritorio Linux** como alternativa si la vía navegador no cumple; la decisión se toma con los criterios de `design.md` (D7).
4. **BREAKING — Se retira el e2e, quedan solo los unitarios.** Se borran los 16 ficheros de tests Playwright y sus helpers, se **portan a unitarios puros** las coberturas que son lógica real (programación de timeline, transiciones, exportación WAV, portadora de ruido), se reestructura `ci.yml` sin ningún job con navegador, y se eliminan los scripts `test:*` de `package.json`. La cobertura que es inherente al navegador (visual, scroll, interacción real) pasa a verificación humana por protocolo.
5. **Referencia matemática extendida.** `tools/math-reference/` pasa a cubrir también `noiseFilterDepthValue`, `interpolateScalar`/`interpolateAudioState`, `strobeRampRatio` en todo el rango y los bordes de banda/mix, para que la verificación que hoy se hizo a mano quede permanente en CI.
6. **Documentación reescrita (obligatorio).** `README.md` y `AGENTS.md` se reescriben para describir el repo resultante: nueva tabla de jobs de CI (sin navegador), política de solo-unitarios, higiene del repo y verificación humana. La política de verificación solo por CI **no cambia**.
7. **Git a una sola rama.** Todo vive en `main`: se borra `astro-migracion` (local y remota, ya fusionada) y las remotas `chore/remove-legacy` y `cortex-ci-only-verification` (su contenido ya está en `main` por otras vías; se verifica antes de borrar). No queda ninguna rama salvo `main`.
8. **Cambios en vuelo conciliados.** `fix-timeline-mix-reset` y `remove-legacy-surface` se archivan (su trabajo está hecho y verificado en CI); `cortex-desktop-ux-redesign` y `cortex-astro-redesign-strobe` se absorben aquí y se eliminan (nunca archivados, sin sync de specs); después se elimina `openspec/changes/archive/` según el punto 1.

## Capabilities

### New Capabilities
- `desktop-workspace-ux`: layout de escritorio sin scroll, jerarquía por tareas, tokens, atajos de teclado y estados de interacción. Absorbido de `cortex-desktop-ux-redesign`.
- `stroboscopic-visuals`: el estrobo v2 — una única superficie flotante visible con el navegador minimizado, apagado por omisión, modos sync/custom, rehecho desde cero. El delta anterior nunca se archivó, así que entra como ADDED.
- `astro-app-shell`: lo esencial del shell Astro salvado de `cortex-astro-redesign-strobe` (la shell existe y funciona; sus requisitos ya son ciertos).
- `unit-verification`: el modelo de verificación nuevo — chequeos estáticos + unitarios puros + build + referencia matemática, todo en CI, sin navegador.
- `repo-hygiene`: reglas del arranque limpio — qué puede vivir en la raíz, dónde va el conocimiento, respaldo fuera del repo, una sola rama.

### Modified Capabilities
- `verification-policy`: sus requisitos hablan de la suite con navegador y de los scripts `test:*`; se reescriben para el modelo solo-unitarios. La regla de fondo (verificación íntegra en CI, sin comando local, navegador solo bajo petición) se conserva.
- `cortex-testing`: del modelo e2e al modelo unitario con simulación de motor de audio y reloj (patrón de `tests/mix-integrity.cjs` y `tests/strobe-worker.cjs`).
- `final-validation`: la exportación WAV sigue verificable (ahora como unitario); snapshots visuales y matriz de navegadores se retiran; la validación subjetiva humana se conserva y gana peso.
- `tooling-evaluation`: se retiran los ítems específicos de navegador (regresión visual, cross-browser); se conservan la decisión basada en evidencia y la adopción reversible.

## Impact

- **Borrados**: 16 tests e2e + helpers en `tests/`, `spikes/`, 6 informes + 1 registro en la raíz, `openspec/changes/archive/`, los scripts `test:*` de `package.json`, los jobs `suite`/`motores`/`matriz` de `ci.yml`, los 4 cambios en vuelo conciliados, 3 ramas de git.
- **Reescritos**: `README.md`, `AGENTS.md`, `ci.yml`, `openspec/config.yaml` (mismas reglas, contexto vigente), `tools/math-reference/*` (ampliación).
- **Nuevos**: tests unitarios portados de las coberturas e2e valiosas, módulos del estrobo v2, tokens CSS.
- **Sin cambio**: el motor de audio (`cortex-audio-engine.js`), el protocolo de escucha humana (`cortex-listening-protocol.md`), el despliegue en Pages (`pages-publication`), y la regla de que **la verificación ocurre íntegra en CI, sin comando local**.
- **Non-goals**: no se añade comando de verificación local; no se optimiza por debajo de 900 px más allá de «usable»; no se implementa HRTF; la build de escritorio Linux solo se evalúa y decide (D7), su implementación es otro cambio si procede; el audio no cambia salvo las superficies del estrobo.

## Decisiones no negociables (marcadas por el usuario)

Lo que sigue lo decidió el usuario y no se reabre durante la ejecución; una sesión que ejecute este cambio lo trata como ley, no como sugerencia:

1. Todo lo de este propose es obligatorio; no se renegocia en apply.
2. UI/UX de escritorio y comodidades, según el alcance absorbido de `cortex-desktop-ux-redesign`.
3. El estrobo se rehace desde cero; una sola superficie flotante; sin mini-reproductor dual; visible con el navegador minimizado; explorar opciones, incluida una build de app de escritorio Linux.
4. Se retira el e2e; quedan solo los unitarios.
5. Los cálculos matemáticos se revisan con librería matemática de Python (hecho en planificación: sin fallos; se extiende la referencia permanente).
6. El repo se organiza como si fuese iniciado desde cero: consolidar y **eliminar** el legado; nada de moverlo a `docs/` ni `archive/`; respaldo fuera del repo.
7. `README.md` y `AGENTS.md` se actualizan obligatoriamente.
8. Ramas: se fusiona todo en `main` y se eliminan las sobrantes.

Lo único que queda abierto (y se decide durante apply, no antes): la dirección visual concreta del rediseño (D6) y la vía del estrobo navegador-vs-escritorio (D7), con los criterios ya escritos en `design.md`.
