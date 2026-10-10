# Design

## Context

Estado real del repo al planificar (octubre de 2026). La sesión que ejecute esto no debe re-investigar nada de lo que sigue.

**Base.** `main` en `d82dd2a`, CI verde con 7 jobs: `ligero` (estáticos + `strobe-worker` + `mix-integrity`, sin navegador), `astro-y-math` (build de Astro + `astro-shell-smoke` con Chromium + referencia matemática Python), `suite` (16 tests Playwright en Chromium), `motores` (timeline+UI en Chromium/Firefox/WebKit), `matriz` (`browser-matrix.cjs`), y los tres sub-jobs de `motores` cuentan como jobs propios en la corrida. Pages publica `dist/` bajo `/cortex-brainwave/` (verificado: HTML/JS/CSS 200, asset inexistente 404).

**Matemáticas — ya verificadas en planificación, sin fallos.** No re-hacer. Se ejecutó `tools/math-reference/reference.py` + `compare.mjs` (lo que corre CI): `failures: []`. Además se verificó de forma independiente con numpy/scipy/sympy un total de 78 casos que la referencia **no** cubre: `noiseFilterDepthValue` (12 combinaciones de carrier/fmod/sampleRate, incluidos extremos `carrier=20`, `carrier=44100`, negativos), `interpolateScalar` (9 casos con NaN/null/negativos), `strobeRampRatio` en 13 frecuencias de 0.5 a 40 Hz, bordes de `bandFromFreq` (4/8/13/30 exactos), `mixPercentToGain` con -100/101/1e9/NaN/null, fase del estrobo con timestamps negativos, e `strobeIntensityAt` con ramp 0/0.008/0.12. Todo coincidió con el JS. Conclusión: **no hay errores matemáticos**; este cambio solo hace permanente esa cobertura (D10).

**Tests.** Unitarios puros: `tests/mix-integrity.cjs` (19/19, motor de audio y reloj simulados) y `tests/strobe-worker.cjs` (el fuente real del Worker del estrobo en `vm`, 28 muestras × 2 variantes: fuente y bundle minificado con esbuild). Estáticos: `tests/light/run-light-verify.cjs` con `dom-references` (76 ids usados vs 108 declarados). E2e a retirar (16 ficheros Playwright): `astro-shell-smoke`, `browser-matrix`, `cortex-browser-helpers` (helper), `native-page-snapshot`, `noise-carrier`, `real-smoke`, `responsive-smoke`, `snapshots`, `strobe-visuals`, `timeline-custom-presets`, `timeline-dock`, `timeline-scheduling`, `timeline-transitions`, `ui-stability`, `visual-smoke`, `wav-e2e`.

**Estrobo actual.** Cuatro módulos: `src/lib/cortex-strobe.js` (339 líneas, superficie integrada + transporte), `cortex-strobe-pip.js` (505, ventanas PiP **y** el mini-reproductor en página — el «dual mini» a eliminar — y `buildStrobeWorkerSource()` que arma el Worker), `cortex-strobe-paint.js` (58), `cortex-strobe-stack.js` (53). Tres vías de presentación: Document PiP (Chromium), PiP de vídeo vía `canvas.captureStream` (Firefox/Safari, con autoverificación de fotogramas a 900 ms), y mini-reproductor en página. La matemática del pintado (`core-math.js`: fase, envolvente, rampa) está verificada y **se conserva**; lo que se rehace es la arquitectura de superficies.

**Cambios en vuelo (4).** `fix-timeline-mix-reset`: 11/12 tareas sin marcar pero **el trabajo está hecho y en verde** (el test real es `mix-integrity.cjs`, no el `timeline-mix-integrity.cjs` que la tarea 1.1 pedía; el anclaje de rampas de 3.1 se implementó; queda 4.2, verificación humana). `remove-legacy-surface`: 1/7 pendiente (3.2, sobre ampliar `DECLARACIONES` solo si hubo falsos positivos — no los hubo). `cortex-desktop-ux-redesign`: 17/18 pendientes, **se absorbe entero aquí**. `cortex-astro-redesign-strobe`: 8/39 pendientes (5.1–5.3 reasignadas al UX, 7.1–7.3 son el rediseño visual, 9.3–9.4 verificación) — **se absorbe**: lo vivo de sus deltas ya vive en las specs `astro-app-shell` y `stroboscopic-visuals` de este cambio.

**Git.** Local: `main` + `astro-migracion` (ya fusionada). Remotas: `origin/astro-migracion` (fusionada), `origin/chore/remove-legacy` y `origin/cortex-ci-only-verification` — `git cherry` las marca `+`, pero su contenido ya llegó a `main` por vías distintas (squash/reimplementación): `remove-legacy` borra superficie que ya no existe en `main`; `ci-only-verification` añade `tests/light/` que ya existe. Antes de borrarlas, confirmar con diff de contenido, no con patch-id.

**Legado en el repo.** Raíz: 6 informes (`cortex-dock-report.md`, `cortex-sdd-validation-report.md`, `cortex-stability-report.md`, `cortex-test-report.md`, `cortex-transitions-report.md`, `noise-investigation.md`), el registro `202609261423-gemini-…-40hz-17msg.txt`, y sin seguimiento: `cortex-ramas.zip`, `files.zip`, `.pi/`. Además `spikes/` y `openspec/changes/archive/` (~45 cambios históricos). `README.md` y `AGENTS.md` describen el CI con navegador y referencian los informes que se borran: **ambos se reescriben**.

**Reglas del proyecto que no cambian.** Verificación íntegra en CI; ningún comando de verificación local existe ni se añade; navegador en la máquina solo bajo petición explícita del usuario; la escucha humana sigue siendo necesaria (`cortex-listening-protocol.md`, que se queda).

## Goals / Non-Goals

**Goals:**
- Un repo que se lea como recién iniciado: raíz limpia, una rama, documentación viva y honesta.
- Rediseño UI/UX desktop con comodidades: tres zonas, tokens, atajos, estados.
- Estrobo v2: una única superficie flotante que sobrevive al navegador minimizado.
- Suite de unitarios puros que preserve la cobertura de lógica valiosa del e2e, en CI sin navegador.
- Referencia matemática permanente que cubra todas las fórmulas puras.
- `README.md` y `AGENTS.md` que describan exactamente ese mundo.

**Non-Goals:**
- Ningún comando de verificación local (sigue prohibido).
- Implementar la build de escritorio Linux: aquí solo se decide (D7).
- Optimizar por debajo de 900 px más allá de «usable».
- HRTF, cambios en el motor de audio o en el formato de persistencia.
- Rehacer la matemática del estrobo: está verificada, se conserva.

## Decisions

### D1 — Legado: consolidar, respaldar fuera, eliminar (no negociable)

Orden estricto: **(1) respaldo fuera del repo**, **(2) destilado del conocimiento**, **(3) borrado**. Nada de `docs/` ni `archive/` como parking.

1. Respaldo: crear `cortex-brainwave-legacy-backup/` **fuera del working tree** (p. ej. `/home/extra/repositorios/cortex-brainwave-legacy-backup/`) y copiar ahí, con un `MANIFEST.md` que liste origen y fecha, todo lo que se va a borrar: los 6 informes, el txt, `spikes/`, `openspec/changes/archive/`, y los zips sin seguimiento (preguntar antes si el usuario los quiere conservar; `.pi/` es de herramienta, se ignora, no se respalda).
2. Destilado antes de borrar: los hechos que `AGENTS.md`/`README.md` aún citan de los informes (límites de Firefox headless, estrangulamiento de timers, etc.) se reescriben en las secciones correspondientes de los docs vivos o se retiran si ya no aplican al modelo sin navegador. La sección «Límites conocidos» de `AGENTS.md` se reescribe alrededor de lo que el nuevo CI sí/no cubre.
3. Borrado: `git rm` para lo tracked, borrado simple para lo untracked. El historial de git conserva todo; el respaldo externo es el acceso rápido.

### D2 — Solo unitarios: qué se borra, qué se porta (no negociable)

Se borran los 16 ficheros e2e listados en Context y los scripts `test:*` de `package.json` (con ellos, `@playwright/test` de `devDependencies` si ya nada lo usa). Se **portan** a unitarios puros, con el patrón de `mix-integrity.cjs`/`strobe-worker.cjs` (import del fuente real + motor/reloj simulados):

- `wav-e2e` → `tests/wav-export.cjs`: ejerce `cortex-wav-export.js` en Node, decodifica RIFF, valida header/canales/duración, canales distintos con binaural activo, sin NaN/Infinity, no-silencio con fuente activa, umbral de clipping.
- `timeline-scheduling` + `timeline-transitions` → `tests/timeline-logic.cjs`: `cortex-timeline-player.js` con reloj simulado: pasos en orden, tiempos de transición, interpolación de estados, mix intacto por paso (lo que ya cubre `mix-integrity`, sin duplicar).
- `noise-carrier` → ampliar el existente o `tests/noise-carrier.cjs`: la relación carrier↔centro de filtro y `noiseFilterDepthValue` contra la referencia matemática (D10 cubre la fórmula; el test unitario cubre el cableado del motor simulado).
- `timeline-dock`/`ui-stability`/`responsive-smoke`/`visual-smoke`/`snapshots`/`real-smoke`/`native-page-snapshot`/`strobe-visuals`/`browser-matrix` → **no se portan**: son navegador por naturaleza. La decisión de superficie (¿se abrió la ventana? ¿se movió el panel?) que sí era lógica se porta al unitario del estrobo v2; el resto queda en verificación humana.

`ci.yml` queda con **dos jobs**: `ligero` (estáticos + `strobe-worker` + `mix-integrity` + los nuevos unitarios, `node` a pelo) y `build-y-math` (npm install, `astro build`, `reference.py` con `requirements-math.txt`, `compare.mjs`, publicación de artifacts). Ningún `playwright install`. `astro-shell-smoke` se sustituye por estáticos sobre `dist/` (el HTML generado referencia JS/CSS existentes — chequeo de rutas, no de render).

### D3 — Estrobo v2: una superficie, desde cero (no negociable)

Se conserva: `core-math.js` (verificado), el patrón Worker + `strobe-worker.cjs` como contrato, el aviso de seguridad. Se rehace: la arquitectura de superficies de `cortex-strobe-pip.js` y `cortex-strobe.js`. Reglas del usuario: **una sola** superficie flotante; **cero** mini-reproductores (ni la animación en página ni una segunda vía «mini»); visible con pestaña cambiada o navegador minimizado; si el navegador no puede, **aviso honesto** y la vista integrada, nada de sustitutos fingidos.

Diseño objetivo: `cortex-strobe-window.js` nuevo (abstrae «la ventana», sea Document PiP o vídeo PiP), sin el estado triple actual. El Worker sigue montándose con esbuild (`buildStrobeWorkerSource` o su sucesor) — el test `strobe-worker.cjs` debe seguir pasando con el fuente real; si el helper cambia de sitio, el test se actualiza en el mismo commit.

### D7 — Vía del estrobo: navegador vs escritorio Linux (decisión en apply, criterios fijos)

**Decisión registrada (2026-10-09, durante apply): VÍA NAVEGADOR — criterio 1 cumplido.**

Navegadores objetivo del usuario en Linux (respuesta directa del usuario): **Chromium + Firefox**.

Evidencia del criterio 1 — «ventana flotante visible con el navegador minimizado»:

- **Document Picture-in-Picture** (Chromium ≥ 116): `documentPictureInPicture.requestWindow()` abre una
  ventana **del sistema operativo**, siempre visible por encima de otras apps, que sigue pintándose
  cuando la pestaña de origen queda en segundo plano o el navegador se minimiza. Documentación
  oficial de Chrome: la ventana PiP «is always on top» y el documento origen sigue enviando
  actualizaciones mientras el usuario interactúa con otras apps. La ventana mantiene sus propios
  rAF/timers mientras la pestaña de origen siga abierta; si la pestaña queda oculta, Chromium sigue
  ejecutando rAF en la ventana PiP (comportamiento documentado y usado por reproductores de video).
- **PiP de vídeo** (Firefox): `video.requestPictureInPicture()` sobre un `<video>` alimentado por
  `canvas.captureStream()` abre la ventana flotante del SO de Firefox, igualmente siempre visible
  con el navegador minimizado. Es la vía que la app ya usaba (autoverificación de fotogramas a
  900 ms) y la razón de ser de esa guarda.

Lo que la vía navegador **no puede garantizar** y queda en verificación humana (tarea 7.2): que la
ventana siga pintándose con el navegador minimizado en el escritorio real del usuario. Ningún
entorno headless lo reproduce (Document PiP exige gestor de ventanas; ver Límites conocidos de
AGENTS.md). El punto de decisión 2 (build de escritorio Linux, Tauri preferido sobre Electron)
**queda descartado en este cambio**: el usuario no pidió re-empaquetar la app y el criterio 1 se
cumple con la vía navegador. Si la sesión humana revelara lo contrario, se abre como cambio aparte.

Criterios (se evalúan al inicio de apply, en ese orden):
1. ¿Document PiP + vídeo PiP cubren «flotante visible con navegador minimizado» en Chromium y Firefox del usuario (Linux)? → **Vía navegador**. Es el radio de impacto mínimo y el usuario no pidió re-empaquetar la app.
2. Solo si (1) falla en los navegadores objetivo: se evalúa **build de escritorio Linux** — preferencia por Tauri (binario pequeño, webview del sistema) sobre Electron, con la app Astro como frontend; su verificación es un cambio aparte, este cambio solo deja la decisión registrada con evidencia.

La comprobación de (1) es una sesión humana explícita (el usuario la pide; está en las tareas finales).

### D4 — UI/UX absorbido (no negociable)

Las 17 tareas pendientes de `cortex-desktop-ux-redesign` pasan a este cambio tal cual, con dos ajustes: su tarea 7.1 (re-asignar 5.1–5.3 en el cambio astro) pierde objeto porque ese cambio se absorbe y borra; y sus tareas de tests e2e (`desktop-layout.cjs` con navegador, actualizar `ui-stability`/`responsive-smoke`) se reformulan: el layout sin scroll se verifica **en la sesión humana de confort**, no con Playwright. El contrato de ids del DOM (`dom-references`) se conserva: el rediseño puede mover nodos pero los ids que el JS pide tienen que seguir declarándose.

### D5 — `README.md` y `AGENTS.md` reescritos (no negociable)

`README.md`: qué es la app, cómo correrla (`npm run dev`), el aviso de gesto para el audio, la nueva tabla de CI (2 jobs, sin navegador), la referencia matemática contra Python, Pages, OpenSpec, y la lista de verificación humana con el protocolo de escucha. `AGENTS.md`: la política de verificación intacta en lo esencial (solo CI, sin comando local, navegador bajo petición), la tabla de jobs nueva, la sección de límites reescrita (lo que CI no cubre: visual, interacción real, visibilidad de la ventana flotante, escucha), higiene del repo (raíz limpia, legado → respaldo externo + git, una sola rama), y el modelo de tests unitarios con simulación. Ninguna referencia a los informes borrados.

### D6 — Dirección visual (la única decisión abierta)

Se decide al inicio de apply con el usuario, antes de maquetar: dirección estética concreta (paleta, tipografía, carácter) y modo claro sí/no. Los tokens de D4 se construyen sobre esa decisión. No hay preferencia previa; el cambio avanza en todo lo demás mientras esto queda pendiente.

### D8 — Git a una sola rama (no negociable)

Orden: **(1)** confirmar contenido de `origin/chore/remove-legacy` y `origin/cortex-ci-only-verification` con diff de contenido contra `main` (los ficheros clave que aportan ya existen en `main` idénticos o superados; patch-id miente con squashes), **(2)** borrar `astro-migracion` local y las tres remotas, **(3)** dejar solo `main`. Si (1) revelara trabajo único no trivial, se trae a `main` antes de borrar — no se descarta trabajo por atajo.

### D9 — Cambios en vuelo conciliados (no negociable)

1. `fix-timeline-mix-reset`: reconciliar `tasks.md` con la realidad implementada (1.1→`mix-integrity.cjs`, 3.1→hecho, etc.), marcar 4.2 como verificación humana pendiente, y **archivar** (`openspec archive`) → sus deltas pasan a specs vivas.
2. `remove-legacy-surface`: 3.2 se cierra (nunca hubo falsos positivos) y **archivar**.
3. `cortex-desktop-ux-redesign` y `cortex-astro-redesign-strobe`: **no se archivan**; se borran tras confirmar que su contenido vivo ya está en las specs de este cambio. Nunca estuvieron archivados, así que nada llega a specs vivas desde ellos y no hay doble-ADDED.
4. Después, `openspec/changes/archive/` entero al respaldo externo (D1) y fuera del repo. Este cambio (`cortex-fresh-start`) queda como único cambio en vuelo.

### D10 — Referencia matemática extendida

En `tools/math-reference/`: nuevas claves en `fixtures.json` (`depthCases`, `interpCases`, `rampCases`, `bandEdgeCases`, `mixEdgeCases`), contrapartes en `reference.py` (incluida `noiseFilterDepthValue` con la misma semántica de clamps), y aserciones en `compare.mjs` con tolerancias (`depth`: 1e-9; el resto 1e-12). Los casos exactos usados en la verificación de planificación (Context) sirven de semilla; se añaden los bordes 4/8/13/30 Hz de banda y 0/100 de mix, que hoy no están.

## Risks / Trade-offs

- **Perder la cobertura de navegador es real.** El usuario lo decidió; la mitigación es doble: unitarios portados para toda la lógica, y una lista explícita de verificación humana en `AGENTS.md` con protocolo. No se pretende que CI «cubra» lo que ya no cubre.
- **Borrar `openspec/changes/archive/` y los informes quita el registro rápido.** Mitigado: respaldo externo con manifiesto + historial de git (nada se pierde de verdad). El usuario ya dijo que no los subiría a remoto de todos modos.
- **El Worker del estrobo depende de esbuild y de la forma del fuente.** Al rehacer `cortex-strobe-pip.js`, `strobe-worker.cjs` (que hace bundle del fuente real) puede romper por construcción; el test y el helper se mueven en el mismo commit.
- **`git cherry` engaña con squash-merge.** Por eso D8 exige diff de contenido antes de borrar ramas.
- **Rediseño con «dirección visual» abierta (D6).** Todo lo demás avanza; solo el maquetado estético bloquea tras los tokens estructurales. Riesgo deScope-creep acotado por las zonas del cambio absorbido.
- **Archivar cambios con tareas sin marcar.** D9 reconcilia antes de archivar; no se archivan promesas falsas ni se marcan tareas como hechas sin estarlo (4.2 queda honestamente pendiente como verificación humana).
