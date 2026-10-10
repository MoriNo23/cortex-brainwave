# AGENTS.md

Reglas del proyecto para agentes y personas que trabajen en **Cortex Brainwave Audio**.
La app es una shell **Astro** (`src/`): el audio, el timeline y los visuales viven en módulos de navegador en `src/lib`.

## Verificación: todo va por CI

**No hay ningún comando de verificación local, y no debe añadirse uno.** No existe script en
`package.json` para correr pruebas, y el proyecto no debe volver a exponerlo.

Cuando un cambio necesite verificación:

1. Se hace el push o se abre el PR.
2. Se lee el resultado en la corrida de CI y sus artifacts.
3. Eso es todo. No se corre nada en la máquina de trabajo para obtener un veredicto.

Un fallo se descubre en CI, no antes del push. Es un intercambio consciente: el primer error
tarda unos minutos más en aparecer, a cambio de que la máquina no se use para verificar nunca.

## Los jobs de CI

`.github/workflows/ci.yml` corre en cada push y en cada pull request **dos jobs, ninguno
con navegador**:

| Job | Qué corre |
|---|---|
| `ligero` | El chequeo estático `dom-references` + los unitarios puros con Node a pelo: `strobe-worker`, `mix-integrity`, `timeline-logic`, `wav-export`, `noise-carrier`, `strobe-window`, `keyboard-shortcuts` |
| `build-y-math` | `astro build`, chequeo estático del build (`dist-references`), `strobe-worker` sobre el fuente minificado con esbuild, y la referencia matemática Python↔JS (`reference.py` + `compare.mjs`, `failures: []`) |

`ligero` no instala dependencias: corre con `node` sobre los fuentes reales. Su reporte se
descarga del artifact `light-verify`; los de build y matemática, del artifact `build-y-math`.

### El modelo de unitarios

La suite es de **unitarios puros en Node**: importan los fuentes reales de `src/lib` y
simulan lo que el navegador proveería — motor de audio (`makeEngine` con nodos falsos),
reloj (`ctx.currentTime` controlado), DOM (`document`/`window` con elementos mínimos) y
`OfflineAudioContext` para el export WAV. Nunca declaran que validaron audio o navegador
reales: verifican lógica. El patrón de referencia es `tests/mix-integrity.cjs` y
`tests/strobe-worker.cjs` (el fuente del Worker en `vm` con `self` y lienzo simulados,
además sobre el bundle minificado, porque esbuild renombra referencias y ahí se cuelan
`ReferenceError` que el fuente sin minificar no muestra).

## Navegador local: solo bajo petición explícita

No se levanta un motor por iniciativa propia. Si el usuario **pide explícitamente** una prueba
de navegador (visual, confort, capturas), se hace **una sola corrida**, acotada a lo pedido, y se
informa de su coste en CPU y memoria.

Antes de proponer un navegador hay que decir **qué pregunta** quedaría sin responder sin él. Si
la respuesta es «ninguna», no se propone. No se abre un navegador para reconfirmar lo que CI ya
reporta.

## Lo que CI no cubre (verificación humana)

Cada punto tiene su protocolo; ningún queda «cubierto» por un test:

- **La escucha.** Protocolo en `cortex-listening-protocol.md`: auriculares, volumen bajo,
  detener ante molestias. Ningún job reproduce percepción.
- **El confort visual del layout.** Sin scroll de página en 1366×768, 1920×1080 y 2560×1080,
  con transporte, timeline y barra de estado visibles. Y la sanidad por debajo de 900 px:
  iniciar/detener, volumen y timeline alcanzables a 800 px.
- **La ventana flotante del estrobo en un escritorio real.** Document Picture-in-Picture
  (Chromium) y PiP de vídeo (Firefox) son ventanas del SO; ningún entorno headless puede
  abrir una de verdad. CI verifica la **decisión** (`strobe-window.cjs`: apertura, cambio de
  frecuencia, cierre, cero superficies huérfanas), no la ventana.
- **La interacción real y los estados visibles** (hover, foco con teclado físico, atajos
  escribiendo en un input de verdad).
- **La ruta de vídeo del PiP en Firefox**: se autoverifica en runtime — si el `<video>` no
  entrega fotogramas en 900 ms, se cierra y se avisa.

## Higiene del repo

- **La raíz solo contiene lo vivo**: la app, su config, `README.md`, `AGENTS.md`, el protocolo
  de escucha y `requirements-math.txt`. Sin informes legado, registros de conversación ni
  carpetas de experimentos.
- **El legado no se aparca**: se respalda **fuera** del working tree
  (`/home/extra/repositorios/cortex-brainwave-legacy-backup/`, con `MANIFEST.md`) y se
  elimina del repo. La recuperación puntual va por git history o ese respaldo, nunca por
  carpetas `docs/`-parking dentro del árbol.
- **Una sola rama de largo plazo**: `main`. Las ramas de trabajo se borran al llegar a `main`.

## Auditorías estáticas opcionales

`tools/README.md` documenta dos, fuera del camino por omisión a propósito: difftastic
requiere un binario que está gitignorado, y ast-grep se resuelve por `npx`, que descarga.
Ambas introducen red en cada uso.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en `openspec/config.yaml` y los
cambios en vuelo en `openspec/changes/`. Al implementar un cambio se verifica en CI, igual
que en cualquier otro trabajo: push, leer los jobs, y no correr pruebas en la máquina.
