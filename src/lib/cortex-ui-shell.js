export function createUiShellController({
  state,
  bands,
  bandFromFreq,
  renderStrobeControls,
}) {
  /* ── BRAIN ── */
  const brainSvg = document.querySelector('.brain-svg');
  const brainRegions = Array.from(document.querySelectorAll('.region'));
  let renderedBand = null;

  function updateSpatialReadout() {
    const parts = [];
    if (state.stereo > 0) parts.push(`Barrido L↔R ${state.stereo}%`);
    if (state.fmod > 0) parts.push(`Frente↔Atrás ${state.fmod}%`);
    if (state.binaural > 0) parts.push(`Ancho binaural ${state.binaural}%`);
    if (state.amod > 0) parts.push(`Pulso ${state.amod}%`);
    if (state.noise > 0) parts.push(`Portadora de ruido ${state.noise}%`);

    const el = document.getElementById('spatialReadout');
    el.innerHTML = parts.length
      ? parts.map((part) => `<span class="spatial-chip">${part}</span>`).join('')
      : '<span class="spatial-chip muted">Sin modulación espacial — sonido centrado</span>';
  }

  /* ── UI: ESCRITURAS DIRIGIDAS Y PLANIFICADOR DE FRAME ──
     Dos piezas juntas:
     1) setText() solo escribe cuando el valor cambió (evita invalidar layout).
     2) markUiDirty() coalesce el trabajo de DOM en una única pasada por frame,
        en vez de una pasada por cada evento `input` del puntero. */
  function setText(target, value) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return false;
    const next = String(value);
    if (el.textContent === next) return false;
    el.textContent = next;
    return true;
  }

  function writeReadouts() {
    setText('valBrainwave', `${state.brainwave.toFixed(1)} Hz`);
    setText('valCarrier', `${Math.round(state.carrier)} Hz`);
    setText('valAmod', `${state.amod}%`);
    setText('valBinaural', `${state.binaural}%`);
    setText('valStereo', `${state.stereo}%`);
    setText('valFmod', `${state.fmod}%`);
    setText('valNoise', `${state.noise}%`);
    setText('valMix', `${state.mix}%`);
    setText('statusBeatValue', `${state.brainwave.toFixed(1)} Hz`);
  }

  function writeSliders() {
    document.getElementById('sliderBrainwave').value = state.brainwave;
    document.getElementById('sliderCarrier').value = state.carrier;
    document.getElementById('sliderAmod').value = state.amod;
    document.getElementById('sliderBinaural').value = state.binaural;
    document.getElementById('sliderStereo').value = state.stereo;
    document.getElementById('sliderFmod').value = state.fmod;
    document.getElementById('sliderNoise').value = state.noise;
    document.getElementById('sliderMix').value = state.mix;
  }

  const UI_JOBS = {
    readouts() { writeReadouts(); },
    controls() { writeSliders(); writeReadouts(); },
    spatial() { updateSpatialReadout(); },
    band() { applyBandInfo(state.band || bandFromFreq(state.brainwave)); },
    strobe() { renderStrobeControls(); },
  };

  const uiDirty = new Set();
  let uiFrame = 0;
  let uiPasses = 0;

  function markUiDirty(...jobs) {
    for (const job of jobs) uiDirty.add(job);
    if (uiFrame) return;
    uiFrame = requestAnimationFrame(() => {
      uiFrame = 0;
      uiPasses += 1;
      const pending = Array.from(uiDirty);
      uiDirty.clear();
      for (const job of pending) UI_JOBS[job]();
    });
  }

  /* La información de banda solo se recalcula al CRUZAR de banda: dentro de una
     banda no se toca ninguno de estos nodos. */
  function applyBandInfo(band) {
    if (band === renderedBand) return false;
    renderedBand = band;
    const info = bands[band];
    brainRegions.forEach((el) => el.classList.remove('active', 'teal-active'));
    info.regions.forEach((regionName) => {
      brainRegions.forEach((el) => {
        if (el.dataset.region !== regionName) return;
        el.classList.add('active');
        if (regionName === 'deep') el.classList.add('teal-active');
      });
    });
    setText('bandName', info.name);
    setText('bandRange', info.range);
    setText('bandDesc', info.desc);
    setText('statusBand', `banda: ${info.name}`);
    document.querySelectorAll('.preset').forEach((el) => el.classList.toggle('active', el.dataset.band === band));
    return true;
  }

  function updateBrain() {
    state.band = bandFromFreq(state.brainwave);
    applyBandInfo(state.band);
    markUiDirty('readouts', 'strobe');
  }

  /* Pulso de regiones: una única custom property por frame en lugar de una
     escritura de estilo inline por región y por tick. */
  function uiPulse(seconds) {
    const pulse = state.playing
      ? 0.85 + 0.15 * Math.sin(seconds * state.brainwave * 0.5)
      : 1;
    if (brainSvg) brainSvg.style.setProperty('--brain-pulse', pulse.toFixed(3));
  }

  function syncUIFromState() {
    writeSliders();
    writeReadouts();
  }

  function getUiPasses() {
    return uiPasses;
  }

  function getRenderedBand() {
    return renderedBand;
  }

  return {
    applyBandInfo,
    getRenderedBand,
    getUiPasses,
    markUiDirty,
    setText,
    syncUIFromState,
    uiPulse,
    updateBrain,
    updateSpatialReadout,
    writeReadouts,
    writeSliders,
  };
}
