export function createTimelineUiController({
  state,
  timelineState,
  uiState,
  builtinPresets,
  getCustomPresets,
  getPresetDefinition,
  snapshotForPreset,
  presetBand,
  createId,
  escapeHtml,
  normalizeDurationUnit,
  durationInputConfig,
  durationHint,
  secondsToDuration,
  persistTimeline,
  persistUiPreferences,
  applyAudioSnapshot,
  getTimelinePlayer,
}) {
  /* ── PLAYHEAD (design D3) ──
    Lee el player, no mantiene reloj propio. La geometría del clip activo se
    cachea al cambiar de paso (una lectura de layout por paso, no por frame) y
    el rAF existente escribe SOLO transform. */
  let playheadGeometry = null;
  let playheadLastX = null;
  let playheadLastScale = null;

  /* ── GESTOS DEL DOCK (design D5) ──
    Pointer Events con umbral de 4 px para distinguir click de arrastre,
    captura del puntero al cruzar el umbral y pointercancel que revierte.
    Los listeners viven en la pista (delegación), no en cada clip: re-renderizar
    clips no duplica handlers. Durante el gesto el render de clips queda en
    pausa (gestureActive) y se consolida al soltar. */
  const clipGesture = {
    active: false,
    pointerId: null,
    kind: null,
    index: -1,
    clipEl: null,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startSeconds: 0,
    pendingSeconds: null,
    thresholdPassed: false,
    targetIndex: -1,
  };
  let gestureActive = false;

  function addTimelinePreset(presetId) {
    const preset = getPresetDefinition(presetId);
    const snapshot = snapshotForPreset(presetId);
    if (!preset || !snapshot) return;
    timelineState.steps.push({
      id: createId('step'),
      presetId,
      durationSeconds: 30,
      snapshot,
      name: preset.name,
      emoji: preset.emoji,
      band: presetBand(preset),
    });
    persistTimeline();
    renderTimeline();
  }

  /* Tira de presets dentro del dock desplegado: la única entrada v1 para
     agregar pasos (el arrastre desde el panel izquierdo queda para v2). */
  function renderTimelinePicker() {
    const picker = document.getElementById('timelinePicker');
    if (!picker) return;
    const presets = [...builtinPresets, ...getCustomPresets()];
    picker.innerHTML = presets.map((preset) => `<button class="dock-pick" type="button" data-add-preset="${escapeHtml(preset.id)}" aria-label="Agregar ${escapeHtml(preset.name)} (${escapeHtml(presetBand(preset))}) a la secuencia">
      <span>${preset.emoji}</span><span class="preset-name">${escapeHtml(preset.name)}</span>
      <span class="timeline-band">${escapeHtml(presetBand(preset))}</span>
    </button>`).join('');
    picker.querySelectorAll('[data-add-preset]').forEach((button) => {
      button.addEventListener('click', () => addTimelinePreset(button.dataset.addPreset));
    });
  }

  function renderDurationUnitButtons(context) {
    document.querySelectorAll(`[data-duration-unit-context="${context}"]`).forEach((button) => {
      button.setAttribute('aria-pressed', String(timelineState.durationUnits[context] === button.dataset.unit));
    });
  }

  /* Sincroniza el editor de duración de transición del toolbar con el estado:
   * valor en la unidad vigente, límites del input y pista del equivalente.
   */
  function renderTransitionControls() {
    const input = document.getElementById('timelineTransitionSeconds');
    if (!input) return;
    const unit = timelineState.durationUnits.transition;
    const config = durationInputConfig('transition', unit);
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.disabled = !timelineState.transition.enabled;
    input.value = secondsToDuration(timelineState.transition.seconds, unit);
    const hint = document.getElementById('timelineTransitionHint');
    if (hint) hint.textContent = timelineState.transition.enabled ? durationHint(timelineState.transition.seconds, unit) : '';
    const toggle = document.getElementById('timelineTransitionEnabled');
    if (toggle) toggle.checked = timelineState.transition.enabled;
    renderDurationUnitButtons('transition');
  }

  /* Cambiar la unidad de un contexto (pasos o transición) convierte el valor
   * mostrado sin tocar los segundos guardados. */
  function setDurationUnit(context, unit) {
    const normalized = normalizeDurationUnit(unit);
    if (timelineState.durationUnits[context] === normalized) return;
    timelineState.durationUnits[context] = normalized;
    persistTimeline();
    renderDurationUnitButtons(context);
    if (context === 'step') renderTimeline();
    else renderTransitionControls();
  }

  /* ── SELECCIÓN E INSPECTOR ──
    Un clip de 44–120 px no aloja un input usable: la selección por click abre
    el inspector de una línea y ahí viven la edición y los reemplazos por
    teclado de los gestos (design D4). */
  function selectedStepIndex() {
    if (!uiState.selectedStepId) return null;
    const index = timelineState.steps.findIndex((step) => step.id === uiState.selectedStepId);
    return index < 0 ? null : index;
  }

  /* La selección NO re-renderiza los clips: alterna la clase en los nodos
     existentes y abre el inspector. No es solo economía — es corrección: si el
     primer click de un doble click reemplazara el nodo, el navegador apuntaría
     el dblclick al ancestro común (fuera del clip) y el preset nunca se
     aplicaría. Conservar la identidad del nodo entre clicks es lo que hace
     que el doble click funcione en un navegador real. */
  function selectStep(index) {
    const step = timelineState.steps[index];
    uiState.selectedStepId = step ? step.id : null;
    const clips = document.querySelectorAll('#dockClips .dock-clip');
    if (clips.length !== timelineState.steps.length) {
      renderTimeline();
      return;
    }
    clips.forEach((clip) => clip.classList.toggle('selected', clip.dataset.stepId === uiState.selectedStepId));
    renderDockInspector();
  }

  function formatStepDuration(seconds) {
    const unit = timelineState.durationUnits.step;
    return `${secondsToDuration(seconds, unit)} ${unit}`;
  }

  /* Regla de tiempos: segmentos con el mismo grow y min-width que los clips,
    así las marcas coinciden con los límites por construcción. */
  function renderDockRuler() {
    const ruler = document.getElementById('dockRuler');
    if (!ruler) return;
    const steps = timelineState.steps;
    if (!steps.length) {
      ruler.replaceChildren();
      return;
    }
    const unit = timelineState.durationUnits.step;
    let cumulative = 0;
    ruler.replaceChildren(...steps.map((step) => {
      cumulative += step.durationSeconds;
      const segment = document.createElement('span');
      segment.className = 'dock-ruler-segment';
      segment.style.setProperty('--seg-grow', step.durationSeconds);
      const label = document.createElement('span');
      label.className = 'dock-ruler-label';
      label.textContent = `${secondsToDuration(cumulative, unit)} ${unit}`;
      segment.appendChild(label);
      return segment;
    }));
  }

  function renderDockInspector() {
    const inspector = document.getElementById('dockInspector');
    if (!inspector) return;
    const index = selectedStepIndex();
    if (index === null) {
      inspector.hidden = true;
      return;
    }
    const step = timelineState.steps[index];
    const unit = timelineState.durationUnits.step;
    const config = durationInputConfig('step', unit);
    const input = document.getElementById('inspectorDuration');
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = secondsToDuration(step.durationSeconds, unit);
    input.setAttribute('aria-label', `Duración de ${step.name} en ${unit === 'min' ? 'minutos' : 'segundos'}`);
    document.getElementById('inspectorName').textContent = `${step.emoji} ${step.name} · ${step.band}`;
    document.getElementById('inspectorDurationHint').textContent = durationHint(step.durationSeconds, unit);
    inspector.hidden = false;
    renderDurationUnitButtons('step');
  }

  /* ── RENDER DEL DOCK (design D6) ──
    La estructura (toolbar, inspector, pista, regla, tira) es markup estático;
    este render solo reescribe los clips por cambio de pasos, selección o
    duraciones. El playhead es un único nodo que se conserva entre renders y
    nunca se re-renderiza desde aquí. */
  function renderTimeline() {
    const container = document.getElementById('dockClips');
    if (!container) return;
    if (gestureActive) return;
    const steps = timelineState.steps;
    document.getElementById('timelineLoop').checked = timelineState.loop;
    const nodes = [];
    if (!steps.length) {
      const empty = document.createElement('div');
      empty.className = 'dock-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'Elegí un preset de la tira para agregar el primer paso.';
      nodes.push(empty);
    } else {
      const player = getTimelinePlayer();
      steps.forEach((step, index) => {
        const isCurrent = player && player.running && player.index === index;
        const isSelected = step.id === uiState.selectedStepId;
        const clip = document.createElement('div');
        clip.className = 'dock-clip' + (isCurrent ? ' current' : '') + (isSelected ? ' selected' : '');
        clip.dataset.stepIndex = index;
        clip.dataset.stepId = step.id;
        clip.dataset.band = step.band;
        clip.setAttribute('role', 'listitem');
        clip.style.setProperty('--clip-grow', step.durationSeconds);
        const label = formatStepDuration(step.durationSeconds);
        clip.innerHTML = `<button class="dock-clip-btn" type="button" data-clip-index="${index}" aria-describedby="dockGestureHint" aria-label="${escapeHtml(step.name)} · banda ${escapeHtml(step.band)} · ${escapeHtml(label)} — click para seleccionar, doble click para aplicar">
          <span class="dock-clip-emoji">${step.emoji}</span>
          <span class="dock-clip-name">${escapeHtml(step.name)}</span>
          <span class="dock-clip-chip" data-clip-chip>${escapeHtml(label)}</span>
        </button>
        <span class="dock-clip-resize" data-clip-resize aria-hidden="true"></span>`;
        nodes.push(clip);
      });
    }
    container.replaceChildren(...nodes, document.getElementById('dockPlayhead'), document.getElementById('dockDropLine'));
    renderDockRuler();
    renderDockInspector();
    refreshPlayheadGeometry();
  }

  function applyDockState() {
    const dock = document.getElementById('timelineDock');
    if (!dock) return;
    dock.dataset.dockState = state.dockExpanded ? 'expanded' : 'collapsed';
    const toggle = document.getElementById('btnOpenTimeline');
    toggle.setAttribute('aria-expanded', String(Boolean(state.dockExpanded)));
    toggle.setAttribute('aria-controls', 'timelineDock');
    toggle.title = state.dockExpanded ? 'Plegar el timeline' : 'Desplegar el timeline';
  }

  function toggleDock() {
    state.dockExpanded = !state.dockExpanded;
    applyDockState();
    persistUiPreferences();
    if (state.dockExpanded) refreshPlayheadGeometry();
  }

  function refreshPlayheadGeometry() {
    playheadGeometry = null;
    playheadLastX = null;
    if (!state.dockExpanded) return;
    const container = document.getElementById('dockClips');
    const player = getTimelinePlayer();
    if (!container || !player || (!player.running && !player.paused)) return;
    if (!timelineState.steps.length) return;
    const index = Math.min(player.index, timelineState.steps.length - 1);
    const clip = container.querySelector(`.dock-clip[data-step-index="${index}"]`);
    if (!clip) return;
    playheadGeometry = { left: clip.offsetLeft, width: clip.offsetWidth };
  }

  /* Fracción dentro del paso y del total de la secuencia, derivada del reloj
    del player. Puro cálculo: no toca el DOM. */
  function playheadFractions() {
    const player = getTimelinePlayer();
    if (!player || (!player.running && !player.paused)) return null;
    const steps = timelineState.steps;
    if (!steps.length) return null;
    const index = Math.min(player.index, steps.length - 1);
    const durationMs = steps[index].durationSeconds * 1000;
    if (durationMs <= 0) return null;
    const remaining = player.remainingMs;
    const inStep = Math.max(0, Math.min(1, 1 - remaining / durationMs));
    let before = 0;
    let total = 0;
    steps.forEach((step, i) => {
      total += step.durationSeconds;
      if (i < index) before += step.durationSeconds;
    });
    const overall = total > 0 ? (before + (inStep * durationMs) / 1000) / total : 0;
    return { index, inStep, overall };
  }

  /* Pase por frame del rAF existente: solo escrituras de transform, tanto del
    playhead como de la barra fina plegada. */
  function updateDockPlayhead() {
    const fractions = playheadFractions();
    const fill = document.getElementById('dockProgressFill');
    if (fill) {
      const scale = fractions ? fractions.overall : 0;
      if (scale !== playheadLastScale) {
        playheadLastScale = scale;
        fill.style.transform = `scaleX(${scale})`;
      }
    }
    const playhead = document.getElementById('dockPlayhead');
    if (!playhead) return;
    if (fractions && state.dockExpanded && playheadGeometry) {
      const x = playheadGeometry.left + fractions.inStep * playheadGeometry.width;
      if (x !== playheadLastX) {
        playheadLastX = x;
        playhead.style.transform = `translateX(${x}px)`;
      }
      playhead.classList.add('visible');
    } else {
      playhead.classList.remove('visible');
    }
  }

  function snapStepSeconds(seconds) {
    const unit = timelineState.durationUnits.step;
    const stepSeconds = unit === 'min' ? 30 : 1;
    return Math.round(seconds / stepSeconds) * stepSeconds;
  }

  function clipElements() {
    return Array.from(document.querySelectorAll('#dockClips .dock-clip'));
  }

  /* Índice de destino (posición en el arreglo sin el clip arrastrado) a partir
    de la posición del puntero sobre los clips restantes. target === index
    equivale a soltar en su lugar: no-op. */
  function dropIndexFromX(clientX) {
    const others = clipElements().filter((el, i) => i !== clipGesture.index);
    let target = others.length;
    for (let i = 0; i < others.length; i += 1) {
      const rect = others[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        target = i;
        break;
      }
    }
    return target;
  }

  function showDropLine(target) {
    const line = document.getElementById('dockDropLine');
    if (!line) return;
    const others = clipElements().filter((el, i) => i !== clipGesture.index);
    let x;
    if (target >= others.length) {
      const last = others[others.length - 1] || clipGesture.clipEl;
      x = last.offsetLeft + last.offsetWidth + 1;
    } else {
      x = others[target].offsetLeft - 3;
    }
    line.style.transform = `translateX(${x}px)`;
    line.classList.add('visible');
  }

  function hideDropLine() {
    const line = document.getElementById('dockDropLine');
    if (line) line.classList.remove('visible');
  }

  function finishClipGesture(cancelled) {
    const gesture = clipGesture;
    clipGesture.active = false;
    gestureActive = false;
    hideDropLine();
    if (gesture.clipEl) gesture.clipEl.classList.remove('dragging');
    if (!gesture.thresholdPassed) return;
    if (cancelled) {
      renderTimeline();
      return;
    }
    if (gesture.kind === 'reorder') {
      if (gesture.targetIndex >= 0 && gesture.targetIndex !== gesture.index) {
        const steps = timelineState.steps;
        const [moved] = steps.splice(gesture.index, 1);
        steps.splice(Math.min(gesture.targetIndex, steps.length), 0, moved);
        persistTimeline();
      }
    } else if (gesture.kind === 'resize' && gesture.pendingSeconds != null && gesture.pendingSeconds !== gesture.startSeconds) {
      timelineState.steps[gesture.index].durationSeconds = gesture.pendingSeconds;
      persistTimeline();
      const player = getTimelinePlayer();
      if (player && player.running && player.index === gesture.index) player.reschedule();
    }
    renderTimeline();
  }

  function bindDockGestures() {
    const clips = document.getElementById('dockClips');
    if (!clips) return;

    clips.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const clip = event.target.closest('.dock-clip');
      if (!clip) return;
      const index = Number(clip.dataset.stepIndex);
      if (!timelineState.steps[index]) return;
      const rect = clip.getBoundingClientRect();
      clipGesture.active = true;
      clipGesture.pointerId = event.pointerId;
      clipGesture.kind = event.clientX > rect.right - 8 ? 'resize' : 'reorder';
      clipGesture.index = index;
      clipGesture.clipEl = clip;
      clipGesture.startX = event.clientX;
      clipGesture.startY = event.clientY;
      clipGesture.startWidth = clip.offsetWidth;
      clipGesture.startSeconds = timelineState.steps[index].durationSeconds;
      clipGesture.pendingSeconds = null;
      clipGesture.thresholdPassed = false;
      clipGesture.targetIndex = -1;
    });

    clips.addEventListener('pointermove', (event) => {
      if (!clipGesture.active || event.pointerId !== clipGesture.pointerId) return;
      const dx = event.clientX - clipGesture.startX;
      if (!clipGesture.thresholdPassed) {
        if (Math.abs(dx) < 4 && Math.abs(event.clientY - clipGesture.startY) < 4) return;
        clipGesture.thresholdPassed = true;
        gestureActive = true;
        try { clipGesture.clipEl.setPointerCapture(event.pointerId); } catch (error) { /* sin captura */ }
        if (clipGesture.kind === 'reorder') clipGesture.clipEl.classList.add('dragging');
      }
      if (clipGesture.kind === 'reorder') {
        clipGesture.targetIndex = dropIndexFromX(event.clientX);
        showDropLine(clipGesture.targetIndex);
      } else {
        const scale = clipGesture.startSeconds / Math.max(1, clipGesture.startWidth);
        const snapped = snapStepSeconds(clipGesture.startSeconds + dx * scale);
        const clamped = Math.max(1, Math.min(3600, snapped));
        if (clamped !== clipGesture.pendingSeconds) {
          clipGesture.pendingSeconds = clamped;
          clipGesture.clipEl.style.setProperty('--clip-grow', clamped);
          const chip = clipGesture.clipEl.querySelector('[data-clip-chip]');
          if (chip) chip.textContent = formatStepDuration(clamped);
        }
      }
    });

    const endGesture = (event) => {
      if (!clipGesture.active || event.pointerId !== clipGesture.pointerId) return;
      finishClipGesture(event.type === 'pointercancel');
    };
    clips.addEventListener('pointerup', endGesture);
    clips.addEventListener('pointercancel', endGesture);

    clips.addEventListener('click', (event) => {
      const clip = event.target.closest('.dock-clip');
      const button = clip && clip.querySelector('[data-clip-index]');
      if (!button) return;
      selectStep(Number(button.dataset.clipIndex));
    });

    clips.addEventListener('dblclick', (event) => {
      const clip = event.target.closest('.dock-clip');
      const button = clip && clip.querySelector('[data-clip-index]');
      if (!button) return;
      const step = timelineState.steps[Number(button.dataset.clipIndex)];
      if (step) applyAudioSnapshot(step.snapshot, `${step.emoji} ${step.name}`);
    });
  }

  function moveSelectedStep(delta) {
    const index = selectedStepIndex();
    if (index === null) return;
    const steps = timelineState.steps;
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    persistTimeline();
    renderTimeline();
  }

  function updateSelectedStepDuration(seconds) {
    const index = selectedStepIndex();
    if (index === null) return false;
    timelineState.steps[index].durationSeconds = seconds;
    persistTimeline();
    const player = getTimelinePlayer();
    if (player && player.running && player.index === index) player.reschedule();
    renderTimeline();
    return true;
  }

  function applySelectedStep() {
    const index = selectedStepIndex();
    if (index === null) return false;
    const step = timelineState.steps[index];
    applyAudioSnapshot(step.snapshot, `${step.emoji} ${step.name}`);
    return true;
  }

  function duplicateSelectedStep() {
    const index = selectedStepIndex();
    if (index === null) return false;
    const steps = timelineState.steps;
    const source = steps[index];
    const copy = { ...source, id: createId('step'), snapshot: { ...source.snapshot } };
    steps.splice(index + 1, 0, copy);
    uiState.selectedStepId = copy.id;
    persistTimeline();
    renderTimeline();
    return true;
  }

  function removeSelectedStep() {
    const index = selectedStepIndex();
    if (index === null) return false;
    timelineState.steps.splice(index, 1);
    uiState.selectedStepId = null;
    persistTimeline();
    renderTimeline();
    return true;
  }

  function clearTimeline() {
    const player = getTimelinePlayer();
    if (player) player.stop();
    timelineState.steps = [];
    uiState.selectedStepId = null;
    persistTimeline();
    renderTimeline();
  }

  return {
    addTimelinePreset,
    applyDockState,
    applySelectedStep,
    bindDockGestures,
    clearTimeline,
    duplicateSelectedStep,
    moveSelectedStep,
    refreshPlayheadGeometry,
    removeSelectedStep,
    renderDurationUnitButtons,
    renderTimeline,
    renderTimelinePicker,
    renderTransitionControls,
    selectStep,
    selectedStepIndex,
    setDurationUnit,
    toggleDock,
    updateDockPlayhead,
    updateSelectedStepDuration,
  };
}
