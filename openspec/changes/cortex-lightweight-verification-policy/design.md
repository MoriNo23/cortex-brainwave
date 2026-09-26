# Design

## Context

Ver `proposal.md` para la motivación. Lo que condiciona el diseño son estos hechos del repo, medidos sobre el estado actual:

- Los catorce scripts de `tests/` importan Playwright. No hay ningún nivel de verificación sin navegador, de modo que hoy el único camino de verificación es heavyweight.
- `node_modules` no está instalado y está gitignorado. Cualquier corrida con navegador paga `npm install` más la descarga del motor.
- `cortex.html` y `cortex.spec.html` tienen cada uno un único `<script>` inline (73.912 y 40.150 bytes). Ninguno tiene `<script src>`, `<link href>` externo ni `fetch`/`XMLHttpRequest`. Ambos bloques pasan `node --check` como ESM; el coste combinado medido es de ~68 ms de CPU.
- El script inline de `cortex.html` referencia 46 identificadores del DOM y el markup declara 72 ids; hoy no hay ninguno huérfano. El arreglo `TESTS` de `cortex.spec.html` tiene 79 entradas con la forma `{ group, name, fn }`.
- `cortex.spec.html` es un runner portable: su lógica de escenarios es JavaScript plano, pero su ejecución requiere un navegador porque lee `AudioContext`, `requestAnimationFrame` y el DOM.
- `openspec/config.yaml` tiene secciones `rules` y `operations` disponibles y hoy vacías.
- No existe `AGENTS.md`. Hay skills de OpenSpec en `.opencode/skills/`, pero ningún archivo de instrucciones de proyecto para el agente.
- `tools/README.md` documenta dos auditorías estáticas: difftastic (binario gitignorado, ausente en el repo) y ast-grep vía `npx --yes --package`, que descarga en cada uso.

Restricción derivada de la conversación con el usuario: el nivel ligero debe ser lo bastante barato que «no consuma CPU» en términos prácticos, y todo lo demás debe ir a un job de GitHub.

## Goals / Non-Goals

**Goals:**

- Un comando único, sin dependencias, que conteste la mayoría de las preguntas de verificación en menos de un segundo.
- Que sea imposible que el camino por omisión levante un motor: no basta con la convención, el comando no debe poder hacerlo.
- Mantener la suite con navegador intacta y ejecutándose en CI, sin perder señal.
- Dejar la política escrita en un lugar que el agente lea sin pedir permiso.

**Non-Goals:**

- No replicating ni reemplazando ninguna prueba de navegador. El nivel ligero no simula audio, ni DOM, ni reloj de audio: no pretende sustituir a la suite, pretende cheaply anteponerse a ella.
- No modificar `cortex.html` ni `cortex.spec.html`. Este cambio no toca el comportamiento de la app.
- No reescribir la estructura de `tests/` ni renombrar scripts existentes.
- No introducir un gestor de dependencias nuevo ni un framework de tests.
- No instrumentar el navegador para medir su propio coste.

## Decisions

### D1. El nivel ligero se implementa con Node y la biblioteca estándar, sin dependencias

Se extraen los bloques `<script>` inline con una expresión regular sobre el texto del archivo, se escriben a un archivo temporal y se validan con `node --check`.

Alternativas consideradas:

- **`node --check` sobre el archivo completo**: no aplica, `.html` no es JavaScript.
- **Cargar el script con `vm` o eval**: ejecutar el código de la app es exactamente lo que se quiere evitar; además el estado del DOM y de audio no existe fuera del navegador y fallaría por motivos falsos.
- **Parser de HTML/JS de terceros** (`cheerio`, `acorn`): ambos violan la restricción de cero dependencias y `node --check` ya da el resultado buscado.
- **Reutilizar el regex de `tools/README.md`**: es exactamente el que se va a usar, ya está probado en este repo contra estos mismos archivos.

Consecuencia aceptada: `node --check` valida sintaxis, no semántica. Un error de runtime sigue escapar al navegador, y por eso el nivel ligero no se presenta como cobertura.

### D2. La extracción se hace en un script de Node, no invocando Python

`tools/README.md` usa Python para extraer el JavaScript inline. El nivel ligero será un `.cjs` más, porque el comando de entrada es un script de Node y no conviene depender de dos runtimes para una verificación que se presenta como mínima. Python queda para las auditorías opt-in que ya lo usan.

### D3. Cada chequeo es un módulo independiente y el runner los agrega

`tests/light/` contendrá un archivo por chequeo (sintaxis, autocontención, referencias del DOM, forma del runner) más un runner que los ejecuta, imprime una línea por chequeo y escribe `artifacts/light-verify.json`. Cada módulo exporta una función que devuelve `{ id, ok, detalle }`.

Alternativa considerada: un único archivo monolítico. Se descartó porque el criterio de «barato y localizable» pide poder invocar un chequeo suelto cuando se depura algo concreto.

### D4. Los identificadores se resuelven con dos patrones, no con un parser de selectores

La verificación de referencias cubre `getElementById('x')` y `$('#x')`. No se intenta interpretar selectores CSS completos: el objetivo es detectar ids eliminados del markup, que es la clase de defecto que el análisis estático sí atrapa de forma fiable. Una comprobación más ambiciosa produciría falsos positivos y erosionaría la confianza en la señal.

### D5. Las auditorías de `tools/README.md` quedan fuera del nivel ligero

difftastic requiere un binario que está gitignorado y ausente; ast-grep se resuelve por `npx --yes`, que descarga en cada uso. Meter ambos en el camino por omisión reintroduce la descarga de red que este cambio elimina. Se mantienen documentados como extras que se invocan a mano, y la spec lo fija con un escenario para que nadie los reenganche por conveniencia.

### D6. La política se duplica de forma deliberada: `AGENTS.md` y `config.yaml`

`AGENTS.md` es lo que lee el agente al arrancar; `operations.apply.guidance` en `openspec/config.yaml` es lo que leen los flujos de apply y archive. Ninguno de los dos alcanza al otro, así que la especificación pide ambos. `AGENTS.md` es la fuente y `config.yaml` la referencia: si divergen, manda `AGENTS.md`. Se acepta la duplicación de una frase-puente a cambio de que la regla no dependa de qué flujo se esté ejecutando.

### D7. El job `ligero` se añade a `ci.yml` sin tocar los jobs existentes

Se añade un job independiente que hace checkout, setup-node y `npm run verify:light`, sin `playwright install`. No se convierte el job `suite` en condicional ni se le quitan pasos a `motores` o `matriz`. Motivo: el valor de esta política es precisamente que la señal rápida y la señal completa queden separadas; unificarlas recrearía la dependencia que se quiere eliminar. El badge del README apunta al workflow, no al job.

### D8. El nombre del script es `verify:light`, no `test:light`

Los scripts `test:*` existentes implican navegador. Mantener el prefijo `test:` para algo que no es una prueba de navegador invitaría a la confusión que este cambio quiere eliminar; `verify:` deja claro que es un nivel de verificación distinto.

## Risks / Trade-offs

- **Un nivel ligero que pasa no dice nada del comportamiento real** → Mitigación: el nombre, la documentación y un escenario de la spec prohíben explícitamente presentar un verde ligero como cobertura de navegador; el resultado se obtiene de CI.
- **Los chequeos estáticos envejecen con el código** — un regex de `getElementById` no sobrevive a un cambio de estilo de acceso al DOM y empezará a dar un verde vacío → Mitigación: el chequeo de forma del runner exige un número de entradas analizado mayor que cero y compara contra el conteo real, de modo que una extracción rota se ve; y el fallo por referencias huérfanas es el que se revisa cuando el DOM cambia.
- **Los falsos positivos erosionan la señal**: un `id` construido dinámicamente o un `$` que no sea jQuery fallarán → Mitigación: se acepta un patrón conservador y, si aparece un falso positivo conocido, la exclusión se documenta en el propio chequeo en vez de relajar el patrón globalmente.
- **`node --check` como ESM puede diferir de cómo el navegador interpreta el bloque** (p.ej. `await` de nivel superior) → Mitigación: verificado hoy que ambos bloques pasan; si en el futuro un bloque usa una construcción que solo es válida en navegador, el fallo del chequeo es visible e interpretable, no un verde falso.
- **El binario de difftastic sigue ausente, así que la auditoría de diff no se puede correr sin descargarlo** → Mitigación: se mantiene como extra opt-in y su ausencia no afecta al nivel ligero; el job `ligero` no lo invoca.
- **`cortex.html` tiene una dependencia remota que el chequeo `self-contained` no ve**: la línea 8 hace `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Serif…')`. El escenario de la spec enumera solo `<script src>`, `<link href>` y `fetch`/`XMLHttpRequest`, así que un `@import` de CSS queda fuera por diseño, no por descuido. Decisión del usuario: documentarlo como excepción conocida en lugar de cambiar la spec o el HTML. Mitigación: el stack ya declara fallback (`'Inter', system-ui, sans-serif`), así que sin red la tipografía degrada a fuentes del sistema sin romper la app; y la excepción queda escrita en `AGENTS.md` y en el README, junto a los límites de cada nivel. Autoalojar el subset `latin` costaría ~279 KB en base64 sobre un archivo que hoy pesa 103 KB, y autoalojar todos los subsets ~867 KB.
- **El badge puede quedar verde mientras el job `ligero` falla**, si el workflow no reporta el job concreto → Mitigación: el badge apunta al estado del workflow completo, que refleja el fallo de cualquier job; se acepta que un badge verde no certifica por sí solo la suite completa.

## Migration Plan

1. Añadir `tests/light/` y el script `verify:light` sin tocar nada más. El nivel ligero es aditivo: si se hace mal, basta con no invocar el comando nuevo.
2. Publicar `AGENTS.md` y la referencia en `config.yaml`. Desde este punto la política queda activa para el agente.
3. Actualizar `README.md` y `tests/README.md` para separar los niveles y añadir el badge.
4. Añadir el job `ligero` a `ci.yml` una vez que el comando funcione en local; los jobs existentes no se tocan.
5. Verificar en el primer push que el job `ligero` pasa en CI y que `suite`, `motores` y `matriz` siguen en verde.

Rollback: revertir el commit. No hay migraciones de datos, no hay cambios en la app y los scripts de navegador no se modifican, así que el estado previo se restaura por completo.

## Open Questions

Ninguna. Las decisiones con impacto en la spec, el enfoque o el desglose de tareas quedaron resueltas con el usuario antes de escribir este documento: alcance del nivel ligero, dónde vive la regla y qué tan estricta es la restricción de navegador.
