# Cortex Brainwave Audio

![CI](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml/badge.svg)

Generador de ondas cerebrales: síntesis Web Audio (binaural, AM/FM, portadora
de ruido), visualizaciones Canvas/SVG, timeline con transiciones y una luz
estroboscópica con ventana flotante. Shell **Astro**, estética de instrumento
clínico impreso — papel claro, tinta oscura, líneas hairline.

## Ejecutar

```bash
npm run dev
```

Levanta la shell Astro en el puerto `4173`: <http://127.0.0.1:4173/>.

**Hay que hacer click en `Iniciar` antes de esperar audio.** Los navegadores no
liberan el contexto de audio hasta un gesto del usuario; sin ese click la
línea de tiempo no puede medir el tiempo y la app lo avisa en vez de fingir
que avanza.

## Audio

La ruta `Noise` usa fuentes L/R, filtros bandpass centrados en `Carrier`,
crossfade con la senoide y modulación de filtro mediante `f-mod`. Esta
implementación se inspira en el comportamiento observable de
[BrainAural](https://brainaural.com/) sin copiar su código.

La aplicación no implementa HRTF real ni efectos médicos. Usar volumen bajo y
detener la escucha ante molestias.

## Verificación: todo por CI

**No existe comando de verificación local y no debe añadirse.** Se hace el
push o se abre el PR y el resultado se lee en la corrida.

[`.github/workflows/ci.yml`](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/ci.yml)
corre **dos jobs sin navegador** en cada push y en cada pull request:

| Job | Qué corre |
|---|---|
| `ligero` | Estáticos (`dom-references`) + unitarios puros con Node a pelo: `strobe-worker`, `mix-integrity`, `timeline-logic`, `wav-export`, `noise-carrier`, `strobe-window`, `keyboard-shortcuts` |
| `build-y-math` | `astro build`, chequeo estático de `dist/` (`dist-references`), Worker del estrobo sobre el bundle minificado y referencia matemática Python↔JS (`failures: []`) |

Los unitarios importan los fuentes reales de `src/lib` con motor de audio,
reloj y DOM simulados: verifican lógica, no píxeles. Ningún job instala o
lanza un navegador; los reportes se leen en los artifacts `light-verify` y
`build-y-math` de cada corrida.

### Referencia matemática contra Python

`tools/math-reference/` mantiene en CI la contraparte Python (numpy/scipy/
sympy) de toda la matemática pura del JS: bandas, binaural, ganancia de mix,
fase y envolvente del estrobo, `noiseFilterDepthValue`, interpolación escalar,
`strobeRampRatio` en todo el rango y bordes/entradas inválidas. La comparación
corre en cada push; una fórmula nueva exige su contraparte en el mismo cambio.

### GitHub Pages

[`.github/workflows/pages.yml`](https://github.com/MoriNo23/cortex-brainwave/actions/workflows/pages.yml)
publica la build de Astro (`dist/`) en GitHub Pages cuando CI da verde en
`main` (y a mano con `workflow_dispatch`). El sitio queda en
`https://morino23.github.io/cortex-brainwave/`.

## Verificación humana

CI no cubre lo que solo una persona puede comprobar. La lista viva está en
`AGENTS.md` y su protocolo de escucha en `cortex-listening-protocol.md`
(auriculares, volumen bajo): comfort visual del layout, escucha real de la
síntesis, y la ventana flotante del estrobo visible con la pestaña cambiada y
el navegador minimizado.

## Atajos de teclado

Con el foco fuera de un control interactivo: **Espacio** inicia/detiene,
**P** pausa el timeline, **[** / **]** paso anterior/siguiente, **T** pliega
el timeline. Cada atajo equivale a un botón visible; con el foco en un input
la tecla escribe y no dispara nada.

## OpenSpec

El proyecto se especifica con OpenSpec; la configuración está en
`openspec/config.yaml` y los cambios en vuelo en `openspec/changes/`.

```bash
npx --yes @fission-ai/openspec@latest list
npx --yes @fission-ai/openspec@latest validate <cambio> --strict --json
```
