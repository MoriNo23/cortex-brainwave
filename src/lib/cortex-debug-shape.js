import {
  AVAILABLE_EMOTES,
  BANDS,
  BUILTIN_PRESETS,
} from './cortex-config.js';
import { createDebugAudioNamespaces } from './cortex-audio-ports.js';
import { createDebugTimelineNamespace } from './cortex-timeline-ports.js';
import { createDebugSettingsNamespace } from './cortex-settings-ports.js';

export function createDebugNamespaces({
  state,
  timelineState,
  runtimeState,
  bandFromFreq,
  audioStack,
  timelineStack,
  settings,
}) {
  return {
    session: {
      state,
      timelineState,
      getTimelinePlayer: () => runtimeState.timelinePlayer,
    },
    catalog: {
      bands: BANDS,
      builtinPresets: BUILTIN_PRESETS,
      availableEmotes: AVAILABLE_EMOTES,
      bandFromFreq,
    },
    ...createDebugAudioNamespaces(audioStack),
    ...createDebugTimelineNamespace(timelineStack),
    ...createDebugSettingsNamespace(settings),
  };
}
