export function createCustomPresetsController({
  uiState,
  timelineState,
  state,
  initialPresets = [],
  availableEmotes,
  normalizeCustomPresets,
  audioSnapshot,
  bandFromFreq,
  createId,
  escapeHtml,
  applyAudioSnapshot,
  renderTimelinePicker,
  renderTimeline,
  persistTimeline,
  showToast,
  openDialog,
  closeDialog,
}) {
  let customPresets = Array.isArray(initialPresets) ? initialPresets : [];

  function getCustomPresets() {
    return customPresets;
  }

  function persistCustomPresets() {
    localStorage.setItem('cortex-custom-presets-v1', JSON.stringify(customPresets));
  }

  function loadCustomPresetData() {
    try {
      const raw = JSON.parse(localStorage.getItem('cortex-custom-presets-v1') || '[]');
      customPresets = normalizeCustomPresets(raw);
    } catch (error) {
      customPresets = [];
    }
  }

  function renderEmojiOptions() {
    const container = document.getElementById('emojiOptions');
    container.innerHTML = availableEmotes.map((emoji) => `<button class="emoji-option${emoji === uiState.selectedCustomEmoji ? ' selected' : ''}" type="button" data-emoji="${emoji}" aria-label="Emote ${emoji}">${emoji}</button>`).join('');
    container.querySelectorAll('[data-emoji]').forEach((button) => button.addEventListener('click', () => {
      uiState.selectedCustomEmoji = button.dataset.emoji;
      renderEmojiOptions();
    }));
    const band = bandFromFreq(state.brainwave);
    document.getElementById('customBandPreview').textContent = `${uiState.selectedCustomEmoji} · banda autoidentificada: ${band}`;
  }

  function openCustomPresetEditor(id = null) {
    uiState.editingCustomPresetId = id;
    const existing = id ? customPresets.find((preset) => preset.id === id) : null;
    document.getElementById('customPresetName').value = existing ? existing.name : '';
    uiState.selectedCustomEmoji = existing ? existing.emoji : availableEmotes[0];
    document.getElementById('presetTitle').textContent = existing ? 'Editar preset personalizado' : 'Preset personalizado';
    renderEmojiOptions();
    openDialog(document.getElementById('presetDialog'));
  }

  function saveCustomPresetFromForm() {
    const name = document.getElementById('customPresetName').value.trim();
    if (!name) {
      showToast('Escribe un nombre para el preset');
      return false;
    }
    const existing = uiState.editingCustomPresetId
      ? customPresets.find((preset) => preset.id === uiState.editingCustomPresetId)
      : null;
    const preset = {
      id: existing ? existing.id : createId('custom'),
      name: name.slice(0, 32),
      emoji: uiState.selectedCustomEmoji,
      state: existing ? { ...existing.state } : audioSnapshot(),
      band: bandFromFreq(existing ? existing.state.brainwave : state.brainwave),
    };
    if (existing) Object.assign(existing, preset);
    else customPresets.push(preset);
    persistCustomPresets();
    renderCustomPresets();
    renderTimelinePicker();
    closeDialog(document.getElementById('presetDialog'));
    showToast(existing ? 'preset actualizado' : 'preset guardado');
    return true;
  }

  function renderCustomPresets() {
    const container = document.getElementById('customPresets');
    if (!container) return;
    container.innerHTML = customPresets.map((preset) => `<div class="preset custom-preset-card" data-custom-preset="${escapeHtml(preset.id)}">
      <button class="timeline-card" type="button" data-apply-custom="${escapeHtml(preset.id)}" aria-label="Aplicar ${escapeHtml(preset.name)}">
        <span class="preset-icon">${preset.emoji}</span><span class="preset-name">${escapeHtml(preset.name)}</span>
        <span class="timeline-band">${escapeHtml(preset.band)}</span>
      </button>
      <div class="custom-preset-actions">
        <button class="btn btn-mini" type="button" data-edit-custom="${escapeHtml(preset.id)}" aria-label="Editar ${escapeHtml(preset.name)}">✎</button>
        <button class="btn btn-mini" type="button" data-delete-custom="${escapeHtml(preset.id)}" aria-label="Eliminar ${escapeHtml(preset.name)}">×</button>
      </div>
    </div>`).join('');
    container.querySelectorAll('[data-apply-custom]').forEach((button) => button.addEventListener('click', () => {
      const preset = customPresets.find((item) => item.id === button.dataset.applyCustom);
      if (preset) applyAudioSnapshot(preset.state, `${preset.emoji} ${preset.name}`);
    }));
    container.querySelectorAll('[data-edit-custom]').forEach((button) => button.addEventListener('click', () => openCustomPresetEditor(button.dataset.editCustom)));
    container.querySelectorAll('[data-delete-custom]').forEach((button) => button.addEventListener('click', () => deleteCustomPreset(button.dataset.deleteCustom)));
  }

  function deleteCustomPreset(id) {
    const preset = customPresets.find((item) => item.id === id);
    if (!preset) return false;
    const used = timelineState.steps.some((step) => step.presetId === id);
    if (used && !window.confirm(`El preset ${preset.name} está en el timeline. ¿Eliminar también esos pasos?`)) return false;
    customPresets = customPresets.filter((item) => item.id !== id);
    timelineState.steps = timelineState.steps.filter((step) => step.presetId !== id);
    persistCustomPresets();
    persistTimeline();
    renderCustomPresets();
    renderTimelinePicker();
    renderTimeline();
    showToast('preset eliminado');
    return true;
  }

  function bindCustomPresetEvents() {
    document.getElementById('btnCreatePreset')?.addEventListener('click', () => openCustomPresetEditor());
    document.getElementById('btnClosePreset')?.addEventListener('click', () => closeDialog(document.getElementById('presetDialog')));
    document.getElementById('btnCancelPreset')?.addEventListener('click', () => closeDialog(document.getElementById('presetDialog')));
    document.getElementById('btnSavePreset')?.addEventListener('click', saveCustomPresetFromForm);
  }

  return {
    bindCustomPresetEvents,
    getCustomPresets,
    loadCustomPresetData,
    openCustomPresetEditor,
    persistCustomPresets,
    renderCustomPresets,
    saveCustomPresetFromForm,
  };
}
