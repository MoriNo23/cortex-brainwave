export function createRuntimeTimelinePorts(timelineStack) {
  return {
    ...timelineStack.customPresets,
    ...timelineStack.playback,
    ...timelineStack.support,
    ...timelineStack.timelineUi,
    applyPreset: timelineStack.preset.applyPreset,
  };
}

export function createDebugTimelineNamespace(timelineStack) {
  const { customPresets, playback, preset, support, timelineUi } = timelineStack;

  return {
    timeline: {
      applyPreset: preset.applyPreset,
      getCustomPresets: customPresets.getCustomPresets,
      addTimelinePreset: timelineUi.addTimelinePreset,
      renderTimeline: timelineUi.renderTimeline,
      openCustomPresetEditor: customPresets.openCustomPresetEditor,
      toggleDock: timelineUi.toggleDock,
      selectStep: timelineUi.selectStep,
      getSelectedStepIndex: () => timelineUi.selectedStepIndex(),
      persistTimeline: support.persistTimeline,
      loadTimelineData: support.loadTimelineData,
      durationToSeconds: support.durationToSeconds,
      secondsToDuration: support.secondsToDuration,
      durationHint: support.durationHint,
      durationInputConfig: support.durationInputConfig,
      setDurationUnit: timelineUi.setDurationUnit,
      renderTransitionControls: timelineUi.renderTransitionControls,
      renderDurationUnitButtons: timelineUi.renderDurationUnitButtons,
      requestGentleStop: playback.requestGentleStop,
    },
  };
}
