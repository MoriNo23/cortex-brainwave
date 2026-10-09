# Validación del SDD y del proyecto

Cambio auditado: `openspec/changes/cortex-astro-redesign-strobe` (en vuelo, sin archivar).
Rama: `arena/01a100bc-cortex-brainwave`, sobre `c9d27cd` de `main`.
Fecha: 2026-10-03.

## 1. Qué se ejecutó y qué devolvió

La política del repo (`AGENTS.md`) dice que el veredicto formal lo da CI. Aun así, antes de
empujar se pasaron las piezas que no necesitan navegador, porque eran las únicas que podían
falsificar el código nuevo:

| Comprobación | Comando | Resultado |
|---|---|---|
| Build del shell Astro | `npm run build` | PASS · 1 página, 50 módulos, `dist/index.html` con `btnStrobeFloat`, `strobePipPlaceholder` y `strobePipClose` |
| Nivel ligero | `node tests/light/run-light-verify.cjs` | PASS · 4 de 4 (`inline-syntax`, `self-contained`, `dom-references` 60 ids usados / 91 declarados / 0 huérfanos, `scenario-runner-shape` 85 entradas) |
| Referencia matemática JS ↔ Python | `reference.py` + `compare.mjs` | PASS · `failures: []` con `numpy 2.4.6`, `scipy 1.17.1`, `sympy 1.14.0` |
| Worker de la ventana flotante | `node tests/strobe-worker.cjs` | PASS · 28 muestras contra la referencia y contra `paintStrobeSurface`; PASS también sobre el bundle minificado con esbuild |
| Mutación de control | Worker con `0.48 → 0.45` y con `RAMP_RATIO 0.12 → 0.4` | FAIL 56 y FAIL 4 · el test detecta la divergencia, no es un verde vacío |

Lo que **no** se ejecutó en la máquina: las suites con navegador. Se empujan y se leen en CI
(jobs `suite`, `motores`, `matriz`), como manda el repo. La ventana flotante, además, no se
puede abrir en un runner headless: no hay gestor de ventanas.

## 2. Estado del SDD

`tasks.md`: **30 hechas, 9 abiertas**. Las abiertas, y por qué importan:

| Tarea | Estado real |
|---|---|
| 5.1–5.3 Rediseño del reproductor y reintegración de timeline/presets | El shell Astro existe y funciona, pero no hay una puerta que verifique el rediseño frente a la especificación. Siguen abiertas con razón. |
| 7.1 Radar/waveform/mapa en el shell | Están migrados (`BrainVisuals.astro`, `cortex-visualizers.js`), pero nadie lo verifica: las suites visuales apuntan al legado. |
| 7.2 / 7.3 Timeline y preferencias en el nuevo estado | **Riesgo real.** `ui-stability`, `timeline-*`, `snapshots` y `browser-matrix` navegan a `/cortex.html`. Del shell nuevo solo responden `astro-shell-smoke.cjs` y, desde este cambio, `strobe-visuals.cjs`. |
| 8.1 Adaptar `cortex.spec.html` | `cortex.spec.html` tiene 85 escenarios y **cero** menciones a estrobo: la suite in-page sigue probando el monolito legado. |
| 9.3 CI completa | Pendiente de la corrida de este push. |
| 9.4 Verificación humana | Pendiente: ergonomía, tolerancia al flash y **abrir la ventana flotante de verdad**, que es lo único que no cubre ningún job. |

Se cerraron en esta pasada: **6.8** (ventana flotante), **6.9** (nada de flash con el documento
oculto), **6.10** (envolvente del flash verificada), **8.3** (pruebas del estrobo) y **8.5**
(Worker ejecutado en Node puro).

## 3. `stroboscopic-visuals`, requisito por requisito

| Requisito del spec | Implementación | Veredicto |
|---|---|---|
| Transporte propio y apagado por omisión | `btnStrobePlay`/`btnStrobeStop`; `STROBE_DEFAULTS.active = false`; `normalizeStrobeState()` fuerza `active: false` en cada restauración, así que ni un reload con ajustes guardados puede encenderlo | Cubierto |
| Sync Brainwave | `strobeFrequencyFromState()` con `mode: 'sync'`; contrastado con Python | Cubierto |
| Frecuencia independiente | `mode: 'custom'` + `clampStrobeHz` (0.5–40 Hz); no toca `state.brainwave` | Cubierto |
| Cuatro presentaciones | integrado / mini / fullscreen / **ventana flotante** (nuevo) | Cubierto tras este cambio |
| Fullscreen con salida segura | `requestFullscreen` con `try/catch` y aviso; antes un rechazo quedaba sin manejar | Corregido |
| Activación deliberada y cautela visible | `strobeWarning` siempre visible, sin autoplay | Cubierto |
| Contrato visual verificable | `strobePhaseWindow` (duty 0.5) + envolvente nueva, ambas contra la referencia Python | Ampliado |
| No parpadear fuera de la vista | `visibilitychange` pinta el reposo; `paintFrame` no parpadea si el documento de la superficie está oculto | Nuevo |

## 4. Bugs encontrados y corregidos

**B1 · El estrobo se congela al cambiar de pestaña** (el origen de la petición).
`renderLoop` vive en `requestAnimationFrame`; con la pestaña oculta el navegador lo pausa y la
superficie se queda en el último fotograma, que puede ser el encendido. Arreglado en dos
frentes: la ventana flotante (que tiene su propio bucle en un documento visible) y
`handleDocumentHidden` (`cortex-strobe.js:175`), que pinta el reposo al ocultarse.

**B2 · No existía el mini reproductor "como en los vídeos".**
El `data-strobe-presentation="mini"` es un panel `position: fixed` *dentro* del documento: no
sobrevive al cambio de pestaña por construcción. El `design.md` lo decidía así (D5) con el
argumento de que forzar un `<video>` artificial complicaría la sincronía. Decisión revisada en
el propio `design.md`: Document Picture-in-Picture mueve el DOM real (no hay vídeo artificial)
y la ruta de vídeo de reserva comparte matemática verificada.

**B3 · `requestFullscreen` sin captura.** Un rechazo (sin activación de usuario, permisos,
iframe) quedaba como *unhandled rejection* en consola — y `astro-shell-smoke` cuenta los
errores de consola como fallo. Ahora hay `try/catch` y aviso por toast.

**B4 · Espacio secuestrado.** `bindKeyboardShortcuts` hacía `preventDefault` sobre cualquier
`Space` cuyo target no fuera `INPUT` y lanzaba siempre `#btnPlay`. Consecuencia: ningún botón
se podía activar con el teclado (ni el play/stop del estrobo), y con el foco en un botón del
timeline se arrancaba el audio. Corregido en `cortex-app-events.js:113-129`.

**B5 · Canvas clavado en píxeles.** `resizeStrobeCanvas` escribía `style.width/height` en px,
congelando el lienzo al primer rect medido y anulando el `width: 100%` del CSS. Ahora el
backing store sigue al tamaño real con DPR acotado a 2, y un `ResizeObserver` cubre los
cambios que no disparan `resize` (dock, fullscreen, ventana flotante).

**B6 · Superficie recortada en pantalla completa.** Con `aspect-ratio: 1/1` y el panel a
`width: 100%`, el cuadrado crecía hasta el ancho del monitor y salía del viewport por arriba y
por abajo. Acotado con `min(100%, calc(100vh - 320px))`.

**B7 · Escrituras de DOM sin filtro en el estrobo.** `renderStrobeControls` reescribía
`textContent` y `slider.value` en cada pasada, justo lo que `setText()` existe para evitar.
Ahora filtra por valor cambiado.

**B8 · `dist/` y `.astro/` sin ignorar.** El build de Astro no estaba en `.gitignore`: el
primer `git add .` se llevaba el build entero. Añadidos, junto con los reportes que genera CI.

**B9 · Inyección de funciones por `fn.toString()` rota al minificar** (bug introducido y cazado
en esta misma pasada). Componer el Worker con `clampStrobeHz.toString()` funciona sin minificar
y revienta con bundle: esbuild renombra la referencia interna y el Worker muere con
`ReferenceError: A is not defined`. Reproducido con `esbuild --minify`. El Worker ahora es una
cadena literal y la garantía de no-divergencia es `tests/strobe-worker.cjs`, que lo ejecuta y
lo compara op por op — prueba que también corre sobre el fuente minificado cuando hay
dependencias instaladas.

## 5. El despliegue en Vercel

`https://cortex-brainwave-git-main-morino23s-projects.vercel.app/` **no es público**: responde
con una redirección a `vercel.com/login` y el título *Protected Deployment – Vercel*. No es un
bug del código; es *Deployment Protection* del proyecto, que Vercel activa por omisión en los
despliegues de preview (esa URL es un preview de `main`, no un dominio de producción).

Para que el enlace se pueda compartir hay que hacer una de estas dos cosas en Vercel →
Settings → Deployment Protection: poner *Standard Protection* en "Vercel Authentication"
(deja público el dominio de producción y protege solo los preview), o desactivarlo del todo.
Conviene revisar también *Password Protection* y *Trusted IPs* en la misma pantalla.

Aparte: el repo ya publica en GitHub Pages con `.github/workflows/pages.yml`, encadenado al
verde de CI en `main`. Es la ruta que el SDD tenía prevista (`pages-publication`); Vercel es un
segundo canal que hoy no está documentado en el repo.

## 6. Lo que este informe no verifica

- **La ventana flotante abierta de verdad.** Ningún runner headless abre Document
  Picture-in-Picture. `strobe-visuals.cjs` verifica la decisión (o se abre y el panel se muda, o
  se degrada a mini player con aviso y sin errores de consola), no la ventana.
- **La ruta de vídeo del PiP (Firefox/Safari).** Se autoverifica en runtime: si el `<video>` no
  entrega fotogramas en 900 ms, se cierra y se degrada. Ese camino no lo cubre CI.
- **Confort visual del flash y tolerancia humana.** Sigue siendo escucha y mirada humanas
  (`cortex-listening-protocol.md`).
- **Paridad de timeline y persistencia en el shell Astro.** Es la tarea 8.1 abierta: las suites
  que podrían responderlo apuntan al legado.
