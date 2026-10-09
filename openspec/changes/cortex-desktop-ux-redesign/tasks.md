# Tasks

> **Verificación:** todo va por CI (`AGENTS.md`). Cada test nuevo se registra en `.github/workflows/ci.yml`. No se abre navegador local por iniciativa propia. Lo subjetivo (comodidad, identidad) se cierra en la tarea 8.2, que es humana.

## 0. Decisiones previas (bloquean la maquetación)
- [ ] 0.1 Elegir dirección visual (D6) y reunir referencias.
- [ ] 0.2 Decidir modo claro sí/no.

## 1. Tokens y base
- [ ] 1.1 Dividir `cortex-redesign.css` en tokens / layout / componentes sin cambiar el aspecto, y verificar que el CI sigue verde.
- [ ] 1.2 Definir los tokens de la dirección elegida y retirar gradientes/cuadrícula/vidrio y estilos inline de estado.

## 2. Layout de escritorio
- [ ] 2.1 Reorganizar la grilla en transporte+sesión / sonido / salida y verificar sin scroll en 1366×768, 1920×1080 y 2560×1080.
- [ ] 2.2 Mover el toggle del timeline al chrome principal.

## 3. Zonas
- [ ] 3.1 Panel de sonido: presets, núcleo y moduladores con pliegues reutilizables.
- [ ] 3.2 Zona de salida: volumen y stop suave (coordinar con `fix-timeline-mix-reset`).
- [ ] 3.3 Visuales y dock del timeline integrados al nuevo layout; el estrobo cambia de superficie, no de comportamiento.

## 4. Interacción
- [ ] 4.1 Estados hover/foco/activo/deshabilitado en todos los controles.
- [ ] 4.2 Atajos de teclado con guardas de foco y botón visible equivalente.

## 5. Contrato y tests
- [ ] 5.1 Inventario de ids del DOM; conservar o migrar con su test.
- [ ] 5.2 Nuevo `tests/desktop-layout.cjs`; actualizar `tests/ui-stability.cjs` y `tests/responsive-smoke.cjs`; registrar en `ci.yml`.
- [ ] 5.3 Actualizar `cortex.spec.html` donde dependa del markup anterior.

## 6. Degradación
- [ ] 6.1 Confirmar que por debajo de 900 px las acciones principales siguen alcanzables.

## 7. Coordinación
- [ ] 7.1 Marcar en `cortex-astro-redesign-strobe` que las tareas 5.1–5.3 pasan a este cambio y refinar su requisito de superficies para que no se contradigan.

## 8. Cierre
- [ ] 8.1 CI completo en verde y revisión de artifacts.
- [ ] 8.2 Verificación humana: comodidad en una sesión real, identidad visual y atajos.
