# Design

## Context

- La base actual es una **app HTML autónoma** con CSS y JS inline. Su fortaleza fue la velocidad de iteración; su costo hoy es el acoplamiento extremo: markup, estilos, engine Web Audio, timeline, radar, waveform, persistencia y harness de pruebas viven todos en los mismos archivos.
- El usuario pidió una combinación de alto impacto: **migrar a Astro**, **rediseñar por completo**, **verificar matemáticas con Python** y **agregar estrobo visual** con controles propios.
- El repositorio además ya tiene una política fuerte: la verificación formal vive en **CI**, no como comando local por omisión. Eso afecta cómo se integra la referencia Python: debe entrar como parte del pipeline, no como ritual manual.
- La feature estroboscópica tiene un componente sensible de UX y seguridad: fullscreen + parpadeo requieren activación explícita, límites deliberados y un lenguaje no médico.

## Goals / Non-Goals

**Goals**

- Reemplazar el shell monolítico actual por un **shell Astro** mantenible.
- Separar el core audiovisual/matemático de la capa de presentación.
- Rediseñar la interfaz con una jerarquía clara para audio, timeline y visuales.
- Introducir un reproductor estroboscópico con dos modos de frecuencia: sincronizado con Brainwave e independiente.
- Verificar en CI, con Python, las fórmulas y salidas de referencia del core numérico.
- Mantener continuidad funcional de lo ya existente: audio base, timeline, presets, persistencia y visualizadores.

**Non-Goals**

- No se usará Astro para ejecutar Web Audio en SSR ni para mover al servidor lógica que depende del navegador.
- No se implementará Picture-in-Picture nativo de navegador para el estrobo: el mini-player será una superficie flotante propia, no un `<video>`.
- No se introducen afirmaciones terapéuticas ni modos médicos.
- No se define aquí un backend: la app sigue siendo front-end estática.

## Decisions

### D1. Astro como shell; núcleo interactivo en islas y módulos browser-only

Astro se adopta como **capa de composición y publicación**, no como sustituto del navegador para Web Audio. El audio, el timeline, Canvas, fullscreen y el estrobo viven en módulos browser-only e islas hidratadas en cliente.

**Razón:** permite ganar estructura, layouts, routing, estilos y composición sin forzar SSR donde no aplica. Las piezas que usan `AudioContext`, `requestAnimationFrame`, `localStorage`, Fullscreen API o eventos de puntero siguen siendo del lado cliente.

**Trade-off:** el proyecto deja de ser un único HTML autocontenido. Se acepta porque el objetivo explícito ya es una refactorización total y no una preservación minimalista del formato actual.

### D2. Migración por dominios, no "big bang" ciego

Aunque la dirección es un rediseño total, la implementación debe moverse por dominios:

1. **Core matemático/audio**
2. **Persistencia/estado**
3. **UI shell + layout**
4. **Timeline**
5. **Visualizaciones existentes**
6. **Estrobo**
7. **Paridad y retiro del legado**

**Razón:** un corte total en una sola pasada vuelve imposible aislar fallos. La arquitectura final sí puede reemplazar por completo la UI anterior, pero la ejecución necesita puertas verificables.

### D3. Estado central explícito y derivaciones puras

El estado debe dividirse en:

- **estado persistente de sesión**: brainwave, carrier, moduladores, mix, presets, timeline, preferencias de dock/UI, configuración del estrobo;
- **estado efímero de reproducción**: playing, clocks, frame progress, fullscreen, mini-player abierto/cerrado;
- **derivaciones puras**: banda, binaural left/right, profundidad FM, envelopes, velocidad del estrobo, chips y readouts.

Las derivaciones numéricas críticas deben salir de **funciones puras** reutilizables tanto por UI como por pruebas.

**Razón:** esto hace posible contrastar JS contra Python sin acoplar la verificación al DOM.

### D4. Rediseño como sistema, no repaint superficial

El rediseño no se trata como cambio cosmético sobre el DOM viejo. Se define un nuevo sistema con:

- layout principal modular;
- tokens de color/espaciado/tipografía;
- componentes con responsabilidades acotadas;
- separación clara entre transporte principal, timeline y superficie visual estroboscópica.

La pantalla estroboscópica debe sentirse como un reproductor visual independiente, no como un checkbox más del panel.

**Decisión de layout:** el estrobo vive en una tarjeta o panel propio con cuatro presentaciones:
- **integrado** en la UI;
- **mini-player** flotante compacto dentro del documento;
- **fullscreen** usando Fullscreen API;
- **ventana flotante** (Picture-in-Picture), que sobrevive al cambio de pestaña — ver D5 revisada.

### D5. Mini-player propio, no PiP del navegador — **REVISADA**

> **Estado original (superado).** El mini-player se implementó como superficie
> flotante/acoplada dentro del documento, sin Picture-in-Picture, con el
> argumento de que el estrobo no es vídeo y forzarlo a un `<video>` artificial
> complicaría la sincronía y la API.

**Qué falló de esa decisión.** La superficie flotante vive dentro del documento,
y un documento en segundo plano no renderiza: al cambiar de pestaña el navegador
congela `requestAnimationFrame` y el estrobo se queda petrificado en el último
fotograma (que puede ser el encendido). El requisito real del usuario no era
"panel pequeño", sino **"que se siga viendo aunque cambie de pestaña"**, y eso
ninguna superficie dentro del documento lo puede cumplir. La decisión original
resolvía el tamaño, no la visibilidad.

**Decisión revisada.** El mini-player integrado se conserva (es el plan B y la
vista por omisión) y se añade una **cuarta presentación: ventana flotante con
Picture-in-Picture**, en dos rutas:

1. **Document Picture-in-Picture** (Chromium 116+): se abre una ventana real,
   siempre encima, y se *mueve* el panel del estrobo ahí dentro. No hay `<video>`
   artificial: es el mismo DOM, el mismo estado y el mismo canvas, así que la
   objeción de sincronía de la decisión original no aplica. El bucle corre con
   el `requestAnimationFrame` de la ventana flotante, que sigue vivo aunque la
   pestaña principal esté oculta.
2. **PiP de vídeo** (resto de motores): un canvas dedicado se pinta desde un
   Worker con `OffscreenCanvas` y se sirve a un `<video>` en PiP vía
   `captureStream()`. El Worker no depende de la visibilidad de la pestaña. La
   sincronía que preocupaba a la decisión original se resuelve con una única
   fuente de verdad matemática: el Worker se compone con el fuente de
   `strobeIntensityAt` y `paintStrobeSurface` (`fn.toString()`), las mismas
   funciones contrastadas contra la referencia de Python, y `tests/strobe-worker.cjs`
   lo ejecuta de verdad para comprobar que no divergen.

**Degradación.** Si ninguna ruta está disponible (o el PiP de vídeo no entrega
fotogramas, que se comprueba en runtime), se avisa por toast y se activa el mini
player integrado: nunca queda un estado intermedio roto.

**Coste aceptado.** El panel puede vivir en otro documento, así que toda
lectura/escritura de DOM del estrobo pasa por `surfaceDocument()`. Es el precio
de la visibilidad entre pestañas.

### D6. Estrobo con dos fuentes de frecuencia

La feature `stroboscopic-visuals` soporta dos modos:

- **Sync Brainwave**: la frecuencia del parpadeo deriva de `state.brainwave`.
- **Custom Hz**: el usuario fija una frecuencia independiente dentro de un rango seguro definido por producto.

Ambos modos comparten transporte (`play` / `stop`) y superficie visual, pero difieren en el origen de frecuencia.

**Razón:** el usuario pidió explícitamente ambas opciones.

### D7. Safety-first en la feature estroboscópica

El estrobo requiere un contrato deliberadamente conservador:

- nunca arranca solo;
- muestra advertencia clara antes del primer uso;
- conserva un estado explícito de apagado;
- fullscreen es una acción separada y visible;
- el área de parpadeo integrada es acotada; la expansión a fullscreen requiere gesto expreso.

**Open point deliberado:** el rango exacto de frecuencia y si habrá un soft-cap por fotosensibilidad debe quedar fijado en implementación tras validación de producto. La especificación puede partir con un rango inicial conservador y ajustar luego si el usuario lo confirma.

### D8. Verificación matemática con referencia Python en CI

La verificación numérica se modela como una **referencia externa determinista** en Python:

- `numpy` para vectores y series temporales;
- `scipy` para utilidades de señal (si hacen falta ventanas, FFT o filtros de contraste);
- `sympy` para derivaciones/formulación simbólica donde ayude a fijar fórmulas esperadas.

El plan es comparar, en CI, resultados JS vs Python sobre un conjunto fijo de casos:

- `bandFromFreq` y límites de banda;
- par binaural `L = carrier`, `R = carrier + brainwave`;
- AM envelope y niveles esperados;
- excursión FM y profundidad;
- mezcla final y clamps;
- temporización y duty cycle del estrobo;
- mapping `sync brainwave → flash frequency`.

La salida de referencia debe serializarse a JSON/artifacts y compararse con tolerancias documentadas.

**Razón:** el usuario pidió evitar alucinación numérica. El control no puede depender solo de intuición o inspección visual del DOM.

### D9. La referencia Python vive en CI, no como requisito local

La política del repo no cambia: la verificación formal sigue ocurriendo en CI. Por tanto, la ruta Python se integra en GitHub Actions (o pipeline equivalente), no como nuevo comando obligatorio de uso diario.

**Razón:** respeta `AGENTS.md` y `verification-policy` sin bloquear la intención del usuario. La matemática sí se contrasta con Python, pero en el lugar oficial de verificación del proyecto.

### D10. Paridad funcional antes de retirar el legado

El legado actual solo puede retirarse cuando el shell Astro cumpla, al menos, con:

- reproducción principal;
- timeline;
- presets/persistencia;
- visualizaciones base o reemplazos explícitos;
- nueva feature estroboscópica;
- CI verde con checks adaptados.

**Razón:** evita perder capacidades existentes durante la migración.

## Proposed Architecture

### Front-end

- `src/pages/index.astro`: shell principal.
- `src/layouts/AppLayout.astro`: layout y metadatos.
- `src/components/`
  - `AudioTransport.*`
  - `ControlPanel.*`
  - `TimelineDock.*`
  - `BrainMap.*`
  - `RadarView.*`
  - `WaveformView.*`
  - `StrobePlayer.*`
  - `MiniStrobePlayer.*`
- `src/lib/core/`
  - `audio-model.js`
  - `timeline-model.js`
  - `strobe-model.js`
  - `state-store.js`
  - `persistence.js`
- `src/lib/browser/`
  - `audio-engine.js`
  - `fullscreen.js`
  - `raf-loop.js`

### Verificación numérica

- `tools/math-reference/` o `tests/math-reference/`
  - `reference.py`
  - fixtures JSON
  - comparación JS ↔ Python
- `requirements.txt` o lock equivalente para `numpy`, `scipy`, `sympy`
- artifact CI con diffs numéricos y tolerancias

## Risks / Trade-offs

- **[El cambio rompe la premisa de HTML único]** → aceptado por alcance explícito del usuario.
- **[Astro introduce build/deps nuevas]** → mitigado con boundaries claros y CI dedicado.
- **[Migra demasiadas piezas a la vez]** → mitigado con ejecución por dominios y puertas de paridad.
- **[El estrobo fullscreen tiene riesgo UX/sensibilidad]** → mitigado con activación explícita, warning y superficie apagada por omisión.
- **[La referencia Python puede divergir del runtime JS por detalles de implementación]** → mitigado con funciones puras, fixtures compartidos y tolerancias explícitas.
- **[El mini-player puede competir con el dock/timeline]** → mitigado con reglas de layout y estados mutuamente claros.
- **[La ventana flotante muda el panel a otro documento y el DOM deja de estar donde el resto del código lo busca]** → mitigado centralizando todo acceso al DOM del estrobo en `surfaceDocument()`, y con reubicación garantizada del panel en `pagehide`.
- **[Picture-in-Picture no está disponible o no entrega fotogramas en algunos motores]** → mitigado con sondeo de capacidad, autoverificación de fotogramas en runtime y degradación explícita a mini player con aviso.
- **[El flash congelado con la pestaña oculta deja luz encendida]** → mitigado pintando el reposo en `visibilitychange` y no parpadeando cuando el documento de la superficie no es visible.

## Migration Plan

1. Abrir el cambio y fijar la especificación (este paso).
2. Crear el shell Astro mínimo sin mover todavía toda la lógica interactiva.
3. Extraer el core matemático/audio a módulos puros y rodearlo con comparadores JS/Python.
4. Re-montar la UI principal con el rediseño nuevo.
5. Migrar timeline y persistencia.
6. Implementar el estrobo y sus tres modos de presentación.
7. Adaptar CI y pruebas de navegador.
8. Retirar o congelar el legado solo cuando exista paridad verificable.

## Open Questions

- ¿Cuál será el rango exacto permitido para el modo `Custom Hz` del estrobo?
- ~~¿El mini-player debe ser movible/libre o simplemente compacto y acoplado?~~ **Resuelta:** ambas cosas, en dos presentaciones distintas. El mini player queda compacto y acoplado dentro del documento; la libertad de moverlo y de conservarlo visible entre pestañas la da la ventana flotante (PiP), que el propio sistema de ventanas del SO permite arrastrar. Ver D5 revisada.
- ¿La publicación final seguirá sirviendo una build estática en Pages o requiere otra ruta de despliegue?
- ¿Se mantendrán los visualizadores actuales (radar/waveform/mapa) rediseñados, o alguno será sustituido por una nueva metáfora visual?
