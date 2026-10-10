# PRD — Verificación UI de Cortex Brainwave Audio (sesión externa)

Documento de entrada para una sesión de pruebas de UI (p. ej. TestSprite).
No es un PRD de producto nuevo: describe el producto existente y el
comportamiento esperado que la sesión debe comprobar en navegador real.
La verificación automatizada permanente vive en CI (unitarios puros, sin
navegador); esta sesión cubre el terreno que CI no puede.

**URL de producción:** https://cortex-brainwave.vercel.app/

---

## 1. Producto

Cortex Brainwave Audio: generador de ondas cerebrales que corre íntegramente
en el navegador. Síntesis Web Audio (binaural, AM/FM, portadora de ruido),
visualizaciones Canvas/SVG, timeline secuenciador y una luz estroboscópica
con ventana flotante. Shell **Astro estática** desplegada en Vercel.

**No hay backend.** Toda la lógica vive en módulos de navegador (`src/lib`);
el sitio es archivos estáticos. Cualquier prueba de «backend» está fuera de
scope (la lógica ya está cubierta por unitarios en CI).

## 2. Identidad visual — «blanco clínico»

- Fondo claro tipo papel, tinta oscura, líneas hairline: instrumento médico
  impreso. Sin gradientes ni vidrio.
- Cifras y etiquetas técnicas en monoespaciada (IBM Plex Mono).
- Acento principal: rojo-ladrillo (botones primarios, valores activos).
- Acento por banda (delta/theta/alpha/beta/gamma) en los clips del timeline.

## 3. Estructura de la interfaz

| Zona | Contenido |
|---|---|
| Header | Logo, guardar/cargar ajustes, **▶ Iniciar** (transporte) |
| Panel izquierdo — **Sonido** | Presets (5 builtin + custom), núcleo (Brainwave, Carrier), moduladores plegables (a-mod, binaural, stereo, f-mod, noise) |
| Centro | Visuales: mapa cerebral interactivo, radar espacial, forma de onda |
| Panel derecho — **Salida** | **Volumen** (mezcla master), guardar/cargar/`↓ .wav`, detener suave (banda objetivo + fade), estado actual, **luz estroboscópica**, glosario |
| Dock inferior | Timeline secuenciador plegable (clips, transportes propios, inspector) |
| Status bar | Estado de reproducción, banda activa, Hz |

## 4. Comportamientos esperados (criterios de aceptación)

### B1. Arranque y transporte — P0
- La página carga **sin errores en consola**.
- ▶ Iniciar responde al click: el texto cambia a «■ Detener», el status dice
  «reproduciendo» y el punto de estado se enciende.
- Al detener: el status pasa por «deteniendo suave» (fade) antes de quedar
  «detenido»; el botón vuelve a «▶ Iniciar».
- **Pausa** (P o el botón Ⅱ del dock): el audio y la secuencia se congelan,
  el footer dice «pausado», el botón principal dice «▶ Reanudar»; reanudar
  sigue por el punto exacto (restante del paso y de la rampa).
- *Contexto: una regresión reciente mataba el JS al cargar y dejaba el botón
  muerto. Este escenario es la guardia de esa regresión.*

### B2. Export `.wav` — P2
- «↓ .wav» está **deshabilitado** mientras nada reproduce, y la razón es
  visible al posar el cursor (title/aria-label).
- Reproduciendo: el click descarga un archivo `cortex-10.0hz-200hz.wav`.

### B3. Timeline — P2
- Play con timeline vacío: no arranca y explica «Agrega al menos un preset».
- Agregar un preset desde la tira: aparece un clip en el dock con el color de
  su banda; el contador de estado se actualiza.
- Pausar congela la posición; reanudar continúa por lo que faltaba.
- El dock pliega/despliega sin perder los clips.

### B4. Atajos de teclado con guardas de foco — P1
- **Espacio** con el foco en la página: inicia/detiene; desde pausa, reanuda.
- **Espacio con el foco en un input**: la tecla escribe y **NO** dispara el transporte.
- **P** pausa/reanuda el transporte completo — audio y secuencia congelados,
  el footer muestra «pausado» — y de nuevo reanuda sin deriva.
- **[** / **]** mueven el paso seleccionado del inspector; **T** pliega el timeline.
- Cada atajo equivale a un botón visible (no hay acción solo-teclado).
- *Límite del entorno*: el foco por teclado sintético (CDP) puede no activar
  `:focus-visible`; si el outline no aparece en una corrida automatizada,
  verificar manualmente con Tab físico antes de reportarlo como fallo.

### B5. Luz estroboscópica — P0
- Al cargar está **apagada** (superficie en reposo; nunca parpadea sola).
- ▶ Play: parpadea a la frecuencia del modo (sync sigue el control Brainwave;
  custom usa su propio slider 0.5–40 Hz).
- ■ Stop: cesa sin animación residual en ninguna superficie.
- El **aviso de seguridad** («Visual flashing…») es visible junto a los
  controles, en panel y dentro de la ventana flotante.
- **Ventana flotante** (máxima prioridad — CI no puede abrirla):
  - En Chromium: «⧉ Ventana flotante» abre una ventana Document PiP, el panel
    se muda ahí, y **sigue parpadeando al cambiar de pestaña o minimizar**.
  - En Firefox: la vía es PiP de vídeo (canvas→video); mismo contrato.
  - *Límite del entorno*: la ventana Document PiP **siempre** lista su URL como
    `about:blank` — es inherente a la API (la ventana no navega a ninguna URL;
    la app mueve su panel al DOM de esa ventana). «about:blank» NO es fallo.
    Verificar el contenido por screenshot de la ventana o a ojo, no por URL.
  - Al cerrar (desde la app o desde la propia ventana): el panel regresa al
    documento, sin superficies huérfanas parpadeando.
  - Si el navegador no ofrece PiP: aviso honesto por toast y queda **solo** la
    vista integrada (no hay mini-reproductor sustituto — verificar que no
    aparece ninguno).
  - *Presupuesto de acciones*: si una corrida automatizada agota su budget
    en este flujo, reportar «blocked: budget» — es límite del harness, no
    defecto de la app; el flujo real son 2–3 clicks.
- Fullscreen: el panel ocupa la pantalla y sale limpio.

### B6. Estados de interacción — P2
- Hover y foco visibles en botones, sliders, presets, clips del dock.
- Navegando con **Tab**, el foco se ve sin inspeccionar el DOM (outline ámbar).
- Controles deshabilitados atenuados, con cursor not-allowed.

### B7. Layout de escritorio — P1
- **Sin scroll de página** en 1366×768 y 1920×1080: header, timeline y status
  bar visibles a la vez.
- 2560×1080: el espacio extra va a visuales y timeline; los controles no se
  estiran más allá de un ancho usable.
- **800 px de ancho** (sanidad, no optimización): iniciar/detener, volumen y
  timeline siguen alcanzables.

## 5. Entorno de la sesión

- Navegadores objetivo: **Chromium ≥ 116** (Document PiP) y **Firefox**
  (PiP de vídeo). WebKit/Safari no es objetivo.
- Resoluciones: 1366×768, 1920×1080, 2560×1080, 800 px.
- Despliegue: Vercel (estático). Sin login, sin estado de servidor;
  los ajustes persisten en `localStorage` del navegador.

## 6. Fuera de alcance

- **Escucha humana** (percepción del audio): protocolo aparte, con auriculares
  a volumen bajo. Ningún resultado de esta sesión la sustituye.
- **Evidencia médica**: la app no declara efectos terapéuticos; nada aquí
  puede presentarse como tal.
- Backend/ APIs: no existen.
- Optimización móvil por debajo de 900 px: solo sanidad de alcance.
- Exactitud matemática (frecuencias, envolventes, export PCM): ya verificada
  en CI contra una referencia Python; no re-verificar aquí.

## 7. Criterio de éxito de la sesión

Cada escenario B1–B7 con un veredicto explícito: pasa / falla (con evidencia:
paso, captura o log de consola) / bloqueado (con la causa del entorno, p. ej.
«sin gestor de ventanas no hay PiP»). Los hallazgos se reportan como
observaciones de UI; no cierran tareas del cambio por sí solos.
