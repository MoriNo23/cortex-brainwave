import { AVAILABLE_EMOTES, createAppState, createTimelineState } from './cortex-config.js';

export function createUiSession() {
  return {
    state: createAppState(),
    timelineState: createTimelineState(),
    customPresets: [],
    ui: {
      editingCustomPresetId: null,
      selectedCustomEmoji: AVAILABLE_EMOTES[0],
      selectedStepId: null,
    },
    runtime: {
      timelinePlayer: null,
    },
  };
}
