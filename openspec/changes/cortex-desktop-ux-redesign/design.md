# Design

## Context

- Shell Astro ya montado: `.app` es un grid `header | main (panel izq. · visuales · panel der.) | dock timeline | status bar` (filas 60px · 1fr · auto · 44px).
- El único recurso escaso confirmado en el repo es el alto en **1366×768** (precedente de `timeline-dock`).
- Hay una sola superficie, la Astro: la legado (`public/cortex.html`) se retiró con `remove-legacy-surface`, así que no queda paridad que conservar.
- Este documento fija *principios y alternativas*. **La dirección visual concreta está pendiente de elección** (Open Questions), así que no se especifican colores ni tipografías finales.

## Goals / Non-Goals

**Goals:** layout de escritorio sin scroll de página; jerarquía por tarea; identidad visual propia; atajos de teclado; estados de interacción claros; contrato de ids o migración con tests.

**Non-Goals:** optimizar móvil; tocar audio/player/persistencia; rediseñar el legado; añadir features (el estrobo se rediseña solo en su superficie, sin cambiar su comportamiento); modo claro (se decide aparte).

## Decisions

### D1. Tres zonas por tarea en vez de una columna larga
Transporte+sesión / Sonido / Salida. Alternativas: **(a)** mantener tres columnas y solo reestilizar — barato pero conserva la jerarquía plana; **(b)** workspace por zonas (elegida); **(c)** pestañas — esconden controles que se usan juntos mientras suena. Se mantiene el dock del timeline ya especificado.

### D2. Desktop-first real: mínimo 1366×768, escalado hasta pantalla ancha
Objetivos verificables: sin scroll de página en 1366×768, 1920×1080 y 2560×1080; en pantallas grandes se gana espacio para visuales y timeline, no se estiran controles. Alternativa descartada: ancho máximo centrado (desperdicia pantalla en la que se vive la sesión).

### D3. Sistema de tokens único
Color, tipografía, espaciado, radios, elevación y estados como variables CSS en un solo lugar; `cortex-redesign.css` se divide en `tokens` / `layout` / `components`. Fin de `style=""` inline para estados. Los acentos por banda (`--band-*`) se conservan porque ya transmiten información.

### D4. Atajos de teclado con alcance seguro
Espacio (iniciar/detener), `P` (pausar timeline), `←/→` (paso anterior/siguiente), `T` (plegar timeline). Se ignoran si el foco está en un `input`, `select`, `textarea` o diálogo. Cada atajo tiene su botón visible: el atajo nunca es la única vía.

### D5. Contrato de ids del DOM
El CI (`dom-references`) falla si el script pide un id que el markup no declara. Se mantienen los ids actuales salvo migración explícita con su test; renombrar es una tarea con su verificación, no un efecto colateral.

### D6. Dirección visual: decidir antes de maquetar
Candidatas (a validar con el usuario; ver Open Questions): **Consola de instrumento** (monoespaciada, densa, números protagonistas), **Estudio/DAW** (pistas, medidores, módulos), **Editorial calmo** (tipografía serif, mucho aire, pocos controles visibles). Hasta elegir, las tareas de maquetación quedan bloqueadas.

## Risks / Trade-offs

- **Alcance:** "rediseño completo" puede crecer sin fin. Mitigación: tareas por zona, cada una verificable, y Non-Goals explícitos.
- **Solape con el cambio en vuelo:** dos cambios describiendo la misma UI. Mitigación: tarea 7.1.
- **Tests de UI frágiles:** los selectores actuales se atan al markup. Mitigación: D5 y actualización de las suites en el mismo cambio.
- **Gusto:** "genérico/incómodo" es subjetivo; la verificación final es humana (tarea 8.2).

## Open Questions
1. **Dirección visual** (D6): consola de instrumento, estudio/DAW o editorial calmo.
2. ¿Hay referencias de apps que te resulten cómodas (editores de audio/video, otros generadores)?
3. ¿Modo claro: sí o no por ahora?
