import { AVAILABLE_EMOTES } from './cortex-config.js';
import { createCustomPresetsController } from './cortex-custom-presets.js';

export function createCustomPresetStack({
  session,
  state,
  timelineState,
  uiState,
  helpers,
  chrome,
  audio,
  timelineUi,
}) {
  const {
    createId,
    escapeHtml,
    bandFromFreq,
    audioSnapshot,
    normalizeCustomPresets,
  } = helpers;
  const { showToast, openDialog, closeDialog } = chrome;
  const { applyAudioSnapshot } = audio;
  const { renderTimelinePicker, renderTimeline, persistTimeline } = timelineUi;

  const customPresetController = createCustomPresetsController({
    uiState,
    timelineState,
    state,
    initialPresets: session.customPresets,
    availableEmotes: AVAILABLE_EMOTES,
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
  });

  const {
    bindCustomPresetEvents,
    getCustomPresets,
    loadCustomPresetData,
    openCustomPresetEditor,
    renderCustomPresets,
  } = customPresetController;

  return {
    customPresetController,
    customPresets: {
      bindCustomPresetEvents,
      getCustomPresets,
      loadCustomPresetData,
      openCustomPresetEditor,
      renderCustomPresets,
    },
  };
}
