import { createVisualizers } from './cortex-visualizers.js';

export function createAudioVisualStack({ state }) {
  const visualizers = createVisualizers({ state });
  const {
    RADAR_SIZE,
    drawRadarFrame,
    drawWaveFrame,
    getRadarStart,
    getWavePhaseState,
    resizeWave,
    setRadarStart,
  } = visualizers;

  return {
    visualizers: {
      RADAR_SIZE,
      drawRadarFrame,
      drawWaveFrame,
      getRadarStart,
      getWavePhaseState,
      resizeWave,
      setRadarStart,
    },
  };
}
