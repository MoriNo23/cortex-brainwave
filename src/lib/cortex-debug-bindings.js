import { createDebugNamespaces } from './cortex-debug-shape.js';

export function createDebugBindings({
  state,
  timelineState,
  runtimeState,
  bandFromFreq,
  audioStack,
  timelineStack,
  settings,
}) {
  return createDebugNamespaces({
    state,
    timelineState,
    runtimeState,
    bandFromFreq,
    audioStack,
    timelineStack,
    settings,
  });
}
