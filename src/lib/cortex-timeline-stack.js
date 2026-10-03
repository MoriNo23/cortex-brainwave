import { createTimelineCoreStack } from './cortex-timeline-core-stack.js';
import { createCustomPresetStack } from './cortex-custom-preset-stack.js';
import { createTimelinePlaybackStack } from './cortex-timeline-playback-stack.js';

export function createTimelineStack({
  session,
  state,
  timelineState,
  uiState,
  runtimeState,
  engine,
  helpers,
  chrome,
  ui,
  audio,
}) {
  let customPresetController;

  function getCustomPresets() {
    return customPresetController?.getCustomPresets() || [];
  }

  const coreStack = createTimelineCoreStack({
    state,
    timelineState,
    uiState,
    runtimeState,
    engine,
    getCustomPresets,
    helpers,
    chrome,
    ui,
    audio,
  });

  const customPresetStack = createCustomPresetStack({
    session,
    state,
    timelineState,
    uiState,
    helpers,
    chrome,
    audio,
    timelineUi: {
      renderTimelinePicker: coreStack.timelineUi.renderTimelinePicker,
      renderTimeline: coreStack.timelineUi.renderTimeline,
      persistTimeline: coreStack.support.persistTimeline,
    },
  });

  customPresetController = customPresetStack.customPresetController;

  const playbackStack = createTimelinePlaybackStack({
    state,
    runtimeState,
    engine,
    helpers,
    chrome,
    ui,
    audio,
    preset: coreStack.preset,
    support: coreStack.support,
  });

  return {
    customPresets: {
      ...customPresetStack.customPresets,
      getCustomPresets,
    },
    playback: playbackStack.playback,
    preset: coreStack.preset,
    support: coreStack.support,
    timelineUi: coreStack.timelineUi,
  };
}
