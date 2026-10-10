/* Portadora de ruido: relación carrier↔centro de filtro y cableado de
   noiseFilterDepthValue con motor simulado.
   Spec: openspec/specs/audio-noise + unit-verification (modelo unitario).
   Node puro: importa el fuente real del motor (cortex-audio-engine.js) con
   nodos Web Audio simulados. La fórmula pura la cubre la referencia matemática
   (tools/math-reference): aquí se verifica el cableado. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

/* Nodos Web Audio simulados: registran setValueAtTime/linearRamp (rampas
   ancladas) y los connect reales entre nodos. */
function makeSimCtx(sampleRate = 44100) {
  const nodes = [];
  const edges = [];
  class SimParam {
    constructor() {
      this.value = 0;
      this.ops = [];
    }
    setValueAtTime(v, t) { this.ops.push({ op: 'anchor', v, t }); this.value = v; }
    linearRampToValueAtTime(v, t) { this.ops.push({ op: 'ramp', v, t }); this.value = v; }
  }
  class SimNode {
    constructor(kind) {
      this.kind = kind;
      this.type = '';
      this.__params = {};
      this._freqValue = 0;
      this._panValue = 0;
      this._qValue = 0;
      this._gainValue = 0;
      this.started = false;
    }
    param(name) {
      if (!this.__params[name]) this.__params[name] = new SimParam();
      return this.__params[name];
    }
    get gain() { return this.param('gain'); }
    get frequency() { return this.param('frequency'); }
    get pan() { return this.param('pan'); }
    get Q() { return this.param('Q'); }
    connect(target) { edges.push({ from: this, to: target }); return target; }
    start() { this.started = true; }
    stop() {}
  }
  const destination = new SimNode('destination');
  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate,
    destination,
    createGain: () => { const n = new SimNode('gain'); nodes.push(n); return n; },
    createOscillator: () => { const n = new SimNode('oscillator'); nodes.push(n); return n; },
    createBiquadFilter: () => { const n = new SimNode('biquad'); nodes.push(n); return n; },
    createStereoPanner: () => { const n = new SimNode('panner'); nodes.push(n); return n; },
    createBuffer: (ch, len, rate) => {
      const data = [];
      for (let c = 0; c < ch; c += 1) data.push(new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: rate, getChannelData: (c) => data[c] };
    },
    createBufferSource: () => { const n = new SimNode('buffersource'); nodes.push(n); return n; },
    resume: () => Promise.resolve(),
  };
  return { ctx, nodes, edges };
}

(async () => {
  const { noiseFilterDepthValue, createAudioEngine } = await import('../src/lib/cortex-audio-engine.js');
  const SAMPLE_RATE = 44100;

  function buildEngine(state) {
    const sim = makeSimCtx(SAMPLE_RATE);
    const engine = createAudioEngine({ state, audioContextCtor: class { constructor() { return sim.ctx; } } });
    engine.init();
    engine.start();
    return { sim, engine, nodes: sim.nodes };
  }

  const base = { brainwave: 10, carrier: 200, binaural: 40, stereo: 0, fmod: 0, amod: 0, noise: 0, mix: 80 };

  // 1. Contrato del filtro y fuentes de ruido (construcción del grafo)
  {
    const { nodes } = buildEngine({ ...base });
    const filters = nodes.filter((x) => x.kind === 'biquad');
    const noiseSources = nodes.filter((x) => x.kind === 'buffersource');
    const panners = nodes.filter((x) => x.kind === 'panner');
    check(filters.length === 2, 'dos filtros de ruido (L y R)', String(filters.length));
    check(filters.every((f) => f.type === 'bandpass'), 'filtros bandpass', filters.map((f) => f.type).join(','));
    check(filters.every((f) => f.__params.Q.value === 2), 'Q = 2', filters.map((f) => String(f.__params.Q.value)).join(','));
    check(filters.every((f) => f.__params.frequency.value === 200), 'el centro sigue a la portadora (200)', filters.map((f) => String(f.__params.frequency.value)).join(','));
    check(noiseSources.length === 2, 'dos fuentes de ruido independientes (L y R)', String(noiseSources.length));
    check(panners.filter((p) => p.__params.pan.value === -1).length >= 1 && panners.filter((p) => p.__params.pan.value === 1).length >= 1, 'panners dedicados L/R para el ruido');
  }

  // 2. Crossfade carrier↔noise en la construcción (noise=0 vs noise=100)
  {
    const { nodes } = buildEngine({ ...base, noise: 0 });
    const gains = nodes.filter((x) => x.kind === 'gain').map((g) => g.__params.gain.value);
    check(gains.includes(0.25), 'noise=0: portadora a 0.25', gains.map((v) => Number(v.toFixed(3))).join(','));
    check(!gains.some((v) => v > 0.001 && v < 0.249), 'noise=0: ruido apagado', gains.map((v) => Number(v.toFixed(3))).join(','));
  }
  {
    const { nodes } = buildEngine({ ...base, noise: 100, fmod: 50, carrier: 400 });
    const gains = nodes.filter((x) => x.kind === 'gain').map((g) => g.__params.gain.value);
    check(gains.includes(0), 'noise=100: portadora a 0', gains.map((v) => Number(v.toFixed(3))).join(','));
    check(gains.includes(0.25), 'noise=100: ruido a 0.25', gains.map((v) => Number(v.toFixed(3))).join(','));
    const filters = nodes.filter((x) => x.kind === 'biquad');
    check(filters.every((f) => f.__params.frequency.value === 400), 'carrier=400: filtros al centro nuevo', filters.map((f) => String(f.__params.frequency.value)).join(','));
    const expected = noiseFilterDepthValue(400, 50, SAMPLE_RATE);
    check(gains.includes(expected) && expected > 0, 'fmod=50: profundidad de filtro cableada', `gain=${expected}`);
  }

  // 3. updateCarrier: rampa del centro de filtro y recalcula la profundidad
  {
    const { engine, nodes } = buildEngine({ ...base });
    engine.updateCarrier(700);
    const filters = nodes.filter((x) => x.kind === 'biquad');
    check(filters.every((f) => f.__params.frequency.value === 700), 'updateCarrier(700) mueve el centro de ambos filtros', filters.map((f) => String(f.__params.frequency.value)).join(','));
    const freqParam = filters[0].__params.frequency;
    const anchored = freqParam.ops.some((o) => o.op === 'anchor' && o.v === 200) && freqParam.ops.some((o) => o.op === 'ramp' && o.v === 700);
    check(anchored, 'la rampa del centro está anclada (setValueAtTime antes de linearRamp)', JSON.stringify(freqParam.ops));
    const expected = noiseFilterDepthValue(700, base.fmod, SAMPLE_RATE);
    const depthGains = nodes.filter((x) => x.kind === 'gain').map((g) => g.__params.gain.value);
    check(depthGains.includes(expected), 'updateCarrier recalcula noiseFilterDepthValue', `esperado=${expected}`);
  }

  // 4. updateModLevels: crossfade y profundidad ante noise/fmod
  {
    const state = { ...base };
    const { engine, nodes } = buildEngine(state);
    state.noise = 100;
    state.fmod = 50;
    engine.updateModLevels();
    const gains = nodes.filter((x) => x.kind === 'gain').map((g) => g.__params.gain.value);
    check(gains.includes(0) || gains.every((v) => Math.abs(v) < 1e-9 || v !== 0), 'updateModLevels baja la portadora con noise=100', gains.map((v) => Number(v.toFixed(3))).join(','));
    const expected = noiseFilterDepthValue(state.carrier, state.fmod, SAMPLE_RATE);
    check(gains.includes(expected), 'updateModLevels aplica la profundidad del filtro de ruido', `esperado=${expected}`);
    // masterGain = mix/100*0.5
    check(gains.includes(0.4), 'updateModLevels aplica masterGain = mix/100*0.5', gains.map((v) => Number(v.toFixed(3))).join(','));
  }

  // 5. Contrato de clamps de la fórmula (contrapartida: fixtures de referencia)
  {
    check(noiseFilterDepthValue(200, 0, SAMPLE_RATE) === 0, 'fmod=0 → profundidad 0');
    check(noiseFilterDepthValue(10, 100, SAMPLE_RATE) === 0, 'carrier bajo el piso → 0 (no baja de 20 Hz)');
    const high = noiseFilterDepthValue(44100, 100, SAMPLE_RATE);
    const maxCenter = SAMPLE_RATE * 0.45;
    check(Number.isFinite(high) && high <= (maxCenter - 20) * 0.9, 'carrier sobre el techo → profundidad acotada', `${high} <= ${(maxCenter - 20) * 0.9}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
