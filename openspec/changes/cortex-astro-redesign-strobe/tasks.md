# Tasks

> ## Cómo se verifica este cambio
>
> Este cambio rompe deliberadamente la estructura actual y agrega una ruta de verificación
> matemática con Python. Aun así, la política del repo se mantiene: la verificación formal se
> lee en CI. No se introduce un nuevo "ritual local" obligatorio.
>
> La implementación deberá añadir jobs o pasos de CI para:
>
> 1. instalar dependencias de Astro y validar `build`;
> 2. instalar dependencias Python (`numpy`, `scipy`, `sympy`) y correr la referencia numérica;
> 3. adaptar las suites de navegador al nuevo shell;
> 4. publicar artifacts con diffs numéricos y reportes UI.
>
> Lo que no puede resolver CI por sí solo — confort visual del rediseño, ergonomía del
> mini-player, tolerancia subjetiva del estrobo — queda para verificación humana controlada.

## 1. SDD y arquitectura base

- [x] 1.1 Confirmar el alcance del rebuild: Astro como shell principal, rediseño completo, estrobo visual y verificación matemática Python en CI.
- [x] 1.2 Definir el árbol objetivo del proyecto (`src/`, `public/`, `src/lib/core`, `src/lib/browser`, componentes y layouts) y documentar qué partes serán browser-only.
- [x] 1.3 Definir la estrategia de coexistencia del legado y la condición exacta para retirarlo.

## 2. Shell Astro

- [x] 2.1 Crear la app Astro y su configuración mínima de build.
- [x] 2.2 Crear el layout principal y la página raíz con placeholders funcionales para audio, timeline, visuales y estrobo.
- [x] 2.3 Establecer el sistema base de diseño: tokens, grid, tipografía, color, spacing y responsive.

## 3. Extracción del core

- [x] 3.1 Extraer las derivaciones puras del modelo actual (banda, binaural, AM, FM, mix, clamps, helpers del timeline) a módulos independientes de la UI.
- [x] 3.2 Diseñar un store/contrato de estado compartido entre transporte principal, timeline y estrobo.
- [x] 3.3 Separar persistencia y defaults del estado efímero de reproducción.

## 4. Verificación matemática con Python

- [x] 4.1 Añadir la infraestructura Python de referencia (`numpy`, `scipy`, `sympy`) con locking/documentación mínima.
- [x] 4.2 Definir fixtures de casos de prueba para brainwave, carrier, AM, binaural, FM, mix y estrobo.
- [x] 4.3 Implementar el generador de referencia Python y exportar salidas deterministas a JSON/artifacts.
- [x] 4.4 Implementar el comparador JS ↔ Python con tolerancias explícitas por magnitud y anotar el criterio de PASS/FAIL.
- [x] 4.5 Integrar esa comparación en CI sin convertirla en un comando local por omisión.

## 5. Rediseño principal

- [ ] 5.1 Implementar la nueva shell visual del reproductor principal y del panel de controles.
- [ ] 5.2 Rediseñar la zona central de visualización y su relación con timeline/controles.
- [ ] 5.3 Reintegrar y rediseñar timeline, presets y persistencia dentro del nuevo layout.

## 6. Feature estroboscópica

- [x] 6.1 Diseñar e implementar la superficie visual estroboscópica integrada en la UI.
- [x] 6.2 Implementar transporte propio `play` / `stop` y estado explícito apagado por omisión.
- [x] 6.3 Implementar modo `Sync Brainwave` y verificar que sigue el valor vivo de `brainwave`.
- [x] 6.4 Implementar modo `Custom Hz` con su propio control de frecuencia y límites definidos.
- [x] 6.5 Implementar modo mini-player flotante.
- [x] 6.6 Implementar fullscreen con Fullscreen API y salida segura.
- [x] 6.7 Añadir warning/consentimiento visible antes del primer uso del estrobo y asegurar que no haya autoplay.

## 7. Visualizadores y paridad

- [ ] 7.1 Migrar o reemplazar radar, waveform y mapa cerebral dentro del shell Astro.
- [ ] 7.2 Verificar que el timeline conserva su comportamiento esencial durante la migración.
- [ ] 7.3 Verificar que guardar/cargar/restaurar preferencias sigue funcionando con el nuevo estado.

## 8. Suites y CI

- [ ] 8.1 Adaptar `cortex.spec.html` o reemplazarlo por una superficie equivalente compatible con la nueva arquitectura, definiendo qué partes permanecen y cuáles se migran.
- [x] 8.2 Adaptar Playwright y los jobs del workflow para el shell Astro y para el nuevo reproductor estroboscópico.
- [ ] 8.3 Añadir pruebas específicas del estrobo: play/stop, sync brainwave, custom Hz, mini-player y fullscreen.
- [x] 8.4 Añadir publicación de artifacts para la referencia numérica Python y para capturas visuales del rediseño.

## 9. Cierre

- [x] 9.1 Documentar la nueva arquitectura y la razón de usar Astro.
- [x] 9.2 Documentar la feature estroboscópica, sus límites y su lenguaje no médico.
- [ ] 9.3 Ejecutar la verificación completa en CI y revisar artifacts.
- [ ] 9.4 Hacer verificación humana controlada: ergonomía del rediseño, claridad del mini-player y tolerancia visual del estrobo en modo integrado y fullscreen.
