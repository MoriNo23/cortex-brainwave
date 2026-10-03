# Proposal

## Why

La app actual resolvió bien la etapa exploratoria: un único `cortex.html` autocontenido, sin bundler ni framework, permitió iterar rápido sobre Web Audio, timeline y visualizaciones. Pero la petición actual ya no es un ajuste incremental: combina **migración a Astro**, **rediseño completo**, **nueva feature estroboscópica** y una exigencia explícita de **verificación matemática con Python** para reducir errores numéricos.

Intentar eso como una sola evolución del HTML inline elevaría demasiado el acoplamiento entre layout, estado, Web Audio, timeline, render Canvas y nuevos modos visuales. También dejaría sin resolver un punto sensible: la luz estroboscópica necesita controles explícitos, límites de seguridad, modo mini-player/fullscreen y un contrato verificable aparte del audio.

Este cambio propone una rebase arquitectónica: **Astro como shell y composición de UI**, un **núcleo de audio/matemática desacoplado**, y una **nueva superficie visual estroboscópica** validada contra referencias numéricas en Python dentro de CI.

## What Changes

- Migrar la aplicación principal a **Astro** con estructura de proyecto moderna (`src/pages`, `src/components`, `src/layouts`, `src/lib`), manteniendo el audio en módulos del navegador y evitando SSR para las piezas que dependen de `window`, `AudioContext`, Canvas y Fullscreen API.
- Reorganizar la app en dominios claros: **core numérico/audio**, **timeline**, **visualizaciones**, **persistencia**, **shell de UI** y **feature estroboscópica**.
- Hacer un **rediseño completo** de la interfaz: nueva jerarquía visual, layout responsive, diseño de paneles más modular y un reproductor estroboscópico que pueda vivir integrado, en mini-player o en pantalla completa.
- Añadir la capability **stroboscopic-visuals** con:
  - superficie visual dedicada (Canvas o bloque controlado),
  - `play` / `stop`,
  - modo **sincronizado con Brainwave**,
  - modo **frecuencia independiente**,
  - conmutación entre **integrado**, **mini-player** y **pantalla completa**.
- Añadir una ruta de **verificación matemática con Python** en CI usando paquetes numéricos (`numpy`, `scipy`, `sympy`) para contrastar las fórmulas y señales de referencia del core JS: mapeos de frecuencia, diferencia binaural, envolvente AM, excursión FM, mezcla, y temporización del estrobo.
- Mantener la política del repositorio: la verificación sigue ocurriendo en **CI**, no como comando local por omisión.

## Capabilities

### New Capabilities
- `astro-app-shell`: shell Astro con rediseño completo, islas interactivas y separación explícita entre presentación y núcleo audiovisual.
- `stroboscopic-visuals`: reproductor visual estroboscópico con play/stop, sync Brainwave, frecuencia independiente y modos integrado / mini-player / fullscreen.

### Modified Capabilities
- `cortex-testing`: añade referencias numéricas Python en CI para validar el core matemático y la feature estroboscópica con tolerancias explícitas.

## Impact

- Estructura del repo:
  - probable incorporación de `astro`, `src/`, `public/`, configuración de build y dependencias de desarrollo asociadas;
  - preservación temporal del material legado solo mientras exista una ruta de migración y paridad verificable.
- UI y arquitectura:
  - desaparición del modelo de HTML monolítico como superficie principal;
  - separación del engine, estado y renderizadores visuales en módulos reutilizables.
- Verificación:
  - nuevos checks CI para `astro build` y para la referencia matemática Python;
  - adaptación de las suites Playwright/in-page al nuevo shell.
- Seguridad y UX:
  - la luz estroboscópica no arranca automáticamente;
  - habrá advertencias explícitas y un contrato de activación voluntaria.

## Non-goals

- No se promete migrar en un único commit sin fase de coexistencia: el cambio es grande y necesita puertas de paridad.
- No se agrega en esta propuesta un modo terapéutico, diagnóstico o claim médico.
- No se decide todavía si el legado se eliminará en la misma iteración o en una posterior; eso queda sujeto a paridad real y verificación de CI.
