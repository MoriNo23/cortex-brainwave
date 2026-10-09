import { createRuntimeSettingsStack } from './cortex-runtime-settings-stack.js';
import { createRuntimeEventsStack } from './cortex-runtime-events-stack.js';
import { createRuntimeLifecycleStack } from './cortex-runtime-lifecycle-stack.js';

export function createAppRuntimeStack({
  state,
  timelineState,
  runtimeState,
  engine,
  chrome,
  audio,
  timeline,
}) {
  const settingsStack = createRuntimeSettingsStack({
    state,
    engine,
    chrome,
    audio,
    timeline,
  });

  const eventsStack = createRuntimeEventsStack({
    state,
    timelineState,
    runtimeState,
    engine,
    chrome,
    audio,
    timeline,
    settings: settingsStack.settings,
    wav: settingsStack.wav,
  });

  const lifecycleStack = createRuntimeLifecycleStack({
    state,
    timelineState,
    runtimeState,
    engine,
    chrome,
    audio,
    timeline,
    settings: settingsStack.settings,
    events: eventsStack.events,
  });

  return {
    lifecycle: lifecycleStack.lifecycle,
    settingsController: settingsStack.settingsController,
  };
}
