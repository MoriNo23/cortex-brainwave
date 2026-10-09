import { createDebugBindings } from './cortex-debug-bindings.js';
import { mountDebugSurface as attachDebugSurface } from './cortex-debug-surface.js';

export function createDebugStack({
  state,
  timelineState,
  runtimeState,
  bandFromFreq,
  audioStack,
  timelineStack,
  settings,
}) {
  const bindings = createDebugBindings({
    state,
    timelineState,
    runtimeState,
    bandFromFreq,
    audioStack,
    timelineStack,
    settings,
  });

  function mountDebugSurface(target = window) {
    return attachDebugSurface({ bindings, target });
  }

  return {
    bindings,
    mountDebugSurface,
  };
}
