# Proposal

## Why

La UI/UX actual se percibe **genérica e incómoda** y la app es, de hecho, una herramienta **desktop-first** (mouse + teclado, pantalla de escritorio, sesiones largas con el timeline a la vista). Lo que el código muestra de esa sensación:

- **Estética de plantilla:** fondo con gradientes radiales y cuadrícula (`body::before`), paneles de vidrio translúcido y emojis como identidad de cada preset. Es el look por defecto de una app oscura "tipo IA", sin una identidad propia.
- **Jerarquía plana:** el panel izquierdo apila presets, núcleo, moduladores y salida (~33 ids) en una sola columna; el botón del timeline (`⌁ Timeline`) está escondido dentro de las herramientas de presets y el pliegue de moduladores es un `▼` con `style` inline.
- **Desktop sin ser desktop:** las únicas media queries son `max-width` (1100 / 900 / 760); no hay una intención de uso de pantalla grande, atajos de teclado ni densidad pensada para puntero.
- **Cuadros de mando mezclados:** lo que *moldeás* (brainwave, carrier, moduladores) y lo que *escuchás* (volumen de salida) conviven sin separación, justo la confusión que alimenta el bug de `fix-timeline-mix-reset`.

El rediseño ya figura en el cambio en vuelo `cortex-astro-redesign-strobe` (tareas 5.1–5.3, abiertas) pero como un ítem genérico dentro de una migración mayor. Este cambio lo **toma a su cargo** con un objetivo de UX explícito.

## What Changes

- Un **espacio de trabajo de escritorio**: layout pensado para 1366×768 como mínimo y que aprovecha 1920×1080 y pantallas anchas, sin scroll de página; transporte, timeline y estado siempre visibles.
- **Jerarquía por tareas:** zona de *transporte y sesión* (iniciar/detener, estado, timeline), zona de *sonido* (brainwave, carrier, moduladores) y zona de *salida* (volumen, stop suave), con el timeline como protagonista y no como extra.
- **Identidad visual propia** sustituyendo gradientes/cuadrícula/vidrio y emojis por un sistema de tokens coherente (tipografía, color, espaciado, estados) con dirección a elegir (ver Open Questions).
- **Ergonomía de escritorio:** densidad para puntero, estados hover/foco/activo claros, **atajos de teclado** (iniciar/detener, pausar, siguiente/anterior paso, plegar timeline) que no interfieren al escribir en un input.
- Limpieza de deuda de UI: sin `style` inline para estados, toggles reutilizables, y se conserva (o migra con tests) el contrato de ids del DOM que valida el CI.
- Por debajo de 900 px la app sigue usable pero **no es objetivo optimizarla**.
- No cambia el audio, el player ni los formatos persistidos.

## Capabilities

### New Capabilities
- `desktop-workspace-ux`: layout de escritorio sin scroll de página, jerarquía transporte/sonido/salida, tokens de diseño, atajos de teclado y estados de interacción.

### Modified Capabilities
- `astro-app-shell` (en vuelo, `cortex-astro-redesign-strobe`): su requisito *"El rediseño reorganiza la app por superficies claras"* queda **refinado** por este cambio. Tarea explícita 7.1 para que ambos no describan UIs contradictorias (mismo precedente que `timeline-dock`).

## Impact

- `src/components/*.astro` (Header, LeftPanel, RightPanel, BrainVisuals, TimelineDock, StatusBar, PresetDialog, Toast), `src/layouts/AppLayout.astro`, `src/styles/cortex-redesign.css` (se reorganiza en tokens + componentes + layout).
- `src/lib/cortex-ui-shell.js` / `cortex-ui-chrome.js` / `cortex-app-events.js` para atajos y toggles.
- La superficie legado (`public/cortex.html`) ya no existe: se retiró con `remove-legacy-surface`, así que el rediseño cubre la app entera.
- Pruebas: nuevo `tests/desktop-layout.cjs` (sin scroll de página en 1366×768, 1920×1080 y 2560×1080; transporte y timeline visibles), actualización de `tests/ui-stability.cjs` y `tests/responsive-smoke.cjs`; registro en `ci.yml`. Sin comando local.
- Coordinación: depende de `fix-timeline-mix-reset` solo en que la zona de *salida* exponga el volumen como control de sesión.
- Sin dependencias nuevas. Límite conocido: las fuentes web remotas (`@import`) ya están documentadas en `AGENTS.md`; el rediseño no debe agravarlo.
