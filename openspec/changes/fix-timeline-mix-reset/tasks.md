# Tasks

> **Verificación:** todo va por CI (`AGENTS.md`). No se añade comando local ni se abre un navegador por iniciativa propia. Cada test se registra en `.github/workflows/ci.yml` y se lee en la corrida.

## 1. Probar la hipótesis (primero, antes de arreglar)
- [ ] 1.1 Escribir `tests/timeline-mix-integrity.cjs`: con `mix = 80`, agregar presets builtin al timeline, reproducir y leer `state.mix`, `masterGain.gain.value` y `carrierOsc.frequency.value` en cada paso.
- [ ] 1.2 Registrarlo en `ci.yml` y confirmar que **falla** con el código actual. Si pasa, detenerse y reabrir la investigación (ver Open Questions de `design.md`).

## 2. Arreglo principal
- [ ] 2.1 `snapshotForBuiltin`: dejar de rellenar con `audioSnapshot()`; emitir solo `brainwave` + defaults del builtin.
- [ ] 2.2 `applyAudioState` / player: el paso no aplica `mix`; `carrier` ausente o inválido se conserva.
- [ ] 2.3 `normalizeTimelineStorage` y `normalizeCustomPresets`: sanear lectura (carrier fuera de 20–1500, `mix` inerte en pasos) sin reescribir lo guardado.
- [ ] 2.4 Capturar el `mix` del usuario al iniciar timeline/fade y restaurarlo en `finishGentleStop`.
- [ ] 2.5 Test de datos viejos (`carrier: 0`, `mix: 0` en `localStorage`) y de stop → iniciar sin recargar.

## 3. Endurecimiento (secundario, retirable)
- [ ] 3.1 Anclar rampas del motor al valor actual antes de `linearRampToValueAtTime`.
- [ ] 3.2 Respaldo por temporizador del stop suave con la pestaña oculta.
- [ ] 3.3 Test de ambos; si no aportan, retirarlos sin tocar el grupo 2.

## 4. Cierre
- [x] 4.1 Sin objeto: `cortex.spec.html` y su arreglo `TESTS` se retiraron con `remove-legacy-surface`; el `mix` por paso queda cubierto por `tests/mix-integrity.cjs`.
- [ ] 4.2 Verificación humana: reproducir un timeline real de varios pasos, detener, reiniciar, y confirmar audio sin recargar.
