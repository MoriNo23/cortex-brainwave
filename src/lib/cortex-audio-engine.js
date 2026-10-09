const AUDIO_RAMP_SECONDS = 0.05;

/* Ancla la rampa al valor que el parámetro tiene ahora mismo. Sin ese
   anclaje, una rampa encadenada parte del último objetivo programado y no
   de donde está realmente el sonido: al solaparse, el salto se oye. */
function rampTo(param, value, t) {
  param.setValueAtTime(param.value, t);
  param.linearRampToValueAtTime(value, t + AUDIO_RAMP_SECONDS);
}

export function noiseFilterDepthValue(carrier, fmod, sampleRate) {
  const maxFrequency = sampleRate * 0.45;
  const center = Math.min(Math.max(carrier, 20), maxFrequency);
  const rawDepth = center * (fmod / 150);
  const safeDepth = Math.max(0, Math.min(center - 20, maxFrequency - center) * 0.9);
  return Math.min(rawDepth, safeDepth);
}

function resolveAudioContextCtor() {
  const scope = globalThis;
  return scope.AudioContext || scope.webkitAudioContext || scope.window?.AudioContext || scope.window?.webkitAudioContext || null;
}

export function createAudioEngine(options) {
  return new AudioEngine(options);
}

export class AudioEngine {
  constructor({ state, audioContextCtor = null } = {}) {
    this.state = state;
    this.audioContextCtor = audioContextCtor;
    this.ctx = null;
    this.nodes = {};
    this.started = false;
    this.needsRebuild = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContextCtor = this.audioContextCtor || resolveAudioContextCtor();
      if (!AudioContextCtor) throw new Error('Web Audio API no disponible en este entorno.');
      this.ctx = new AudioContextCtor();
    }
    if (Object.keys(this.nodes).length > 0) return;
    this.buildGraph();
  }

  buildGraph() {
    const ctx = this.ctx;
    const state = this.state;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = state.mix / 100 * 0.5;
    this.masterGain.connect(ctx.destination);

    this.carrierOsc = ctx.createOscillator();
    this.carrierOsc.type = 'sine';
    this.carrierOsc.frequency.value = state.carrier;
    this.carrierGain = ctx.createGain();
    this.carrierGain.gain.value = 0.25;
    this.carrierOsc.connect(this.carrierGain);

    this.amModGain = ctx.createGain();
    this.amModGain.gain.value = 1;
    this.carrierGain.connect(this.amModGain);

    this.amLfo = ctx.createOscillator();
    this.amLfo.type = 'sine';
    this.amLfo.frequency.value = state.brainwave;
    this.amLfoGain = ctx.createGain();
    this.amLfoGain.gain.value = 0;
    this.amLfo.connect(this.amLfoGain);
    this.amLfoGain.connect(this.amModGain.gain);

    this.binGainL = ctx.createGain();
    this.binGainR = ctx.createGain();
    this.binGainL.gain.value = 0;
    this.binGainR.gain.value = 0;
    this.binOscL = ctx.createOscillator();
    this.binOscR = ctx.createOscillator();
    this.binOscL.type = 'sine';
    this.binOscR.type = 'sine';
    this.binOscL.frequency.value = state.carrier;
    this.binOscR.frequency.value = state.carrier + state.brainwave;
    this.binPanL = ctx.createStereoPanner();
    this.binPanR = ctx.createStereoPanner();
    this.binPanL.pan.value = -1;
    this.binPanR.pan.value = 1;
    this.binOscL.connect(this.binGainL).connect(this.binPanL);
    this.binOscR.connect(this.binGainR).connect(this.binPanR);

    this.stereoGain = ctx.createGain();
    this.stereoGain.gain.value = 0;
    this.stereoPanner = ctx.createStereoPanner();
    this.stereoPanner.pan.value = 0;
    this.stereoOsc = ctx.createOscillator();
    this.stereoOsc.type = 'sine';
    this.stereoOsc.frequency.value = state.carrier;
    this.stereoOsc.connect(this.stereoGain).connect(this.stereoPanner);
    this.stereoLfo = ctx.createOscillator();
    this.stereoLfo.type = 'sine';
    this.stereoLfo.frequency.value = state.brainwave;
    this.stereoLfoGain = ctx.createGain();
    this.stereoLfoGain.gain.value = 1;
    this.stereoLfo.connect(this.stereoLfoGain);
    this.stereoLfoGain.connect(this.stereoPanner.pan);

    this.fmLfo = ctx.createOscillator();
    this.fmLfo.type = 'sine';
    this.fmLfo.frequency.value = state.brainwave;
    this.fmLfoDepth = ctx.createGain();
    this.fmLfoDepth.gain.value = 0;
    this.fmLfo.connect(this.fmLfoDepth);
    this.fmLfoDepth.connect(this.carrierOsc.frequency);

    const noiseAmount = state.noise / 100;
    this.noiseBlendGain = ctx.createGain();
    this.noiseBlendGain.gain.value = 0.25 * noiseAmount;
    this.noiseFilterL = ctx.createBiquadFilter();
    this.noiseFilterR = ctx.createBiquadFilter();
    for (const filter of [this.noiseFilterL, this.noiseFilterR]) {
      filter.type = 'bandpass';
      filter.frequency.value = state.carrier;
      filter.Q.value = 2;
    }
    this.noisePanL = ctx.createStereoPanner();
    this.noisePanR = ctx.createStereoPanner();
    this.noisePanL.pan.value = -1;
    this.noisePanR.pan.value = 1;
    this.noiseFilterDepth = ctx.createGain();
    this.noiseFilterDepth.gain.value = noiseFilterDepthValue(state.carrier, state.fmod, ctx.sampleRate);

    const bufferSize = 2 * ctx.sampleRate;
    const noiseBufferL = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const noiseBufferR = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const dataL = noiseBufferL.getChannelData(0);
    const dataR = noiseBufferR.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      dataL[i] = Math.random() * 2 - 1;
      dataR[i] = Math.random() * 2 - 1;
    }
    this.noiseSourceL = ctx.createBufferSource();
    this.noiseSourceR = ctx.createBufferSource();
    this.noiseSourceL.buffer = noiseBufferL;
    this.noiseSourceL.loop = true;
    this.noiseSourceR.buffer = noiseBufferR;
    this.noiseSourceR.loop = true;
    this.noiseSourceL.connect(this.noiseFilterL);
    this.noiseSourceR.connect(this.noiseFilterR);
    this.noiseFilterL.connect(this.noisePanL);
    this.noiseFilterR.connect(this.noisePanR);
    this.noisePanL.connect(this.noiseBlendGain);
    this.noisePanR.connect(this.noiseBlendGain);
    this.noiseBlendGain.connect(this.amModGain);
    this.fmLfo.connect(this.noiseFilterDepth);
    this.noiseFilterDepth.connect(this.noiseFilterL.frequency);
    this.noiseFilterDepth.connect(this.noiseFilterR.frequency);

    this.amModGain.connect(this.masterGain);
    this.binPanL.connect(this.masterGain);
    this.binPanR.connect(this.masterGain);
    this.stereoPanner.connect(this.masterGain);

    this.nodes = {
      carrierOsc: this.carrierOsc,
      carrierGain: this.carrierGain,
      amLfo: this.amLfo,
      amLfoGain: this.amLfoGain,
      binOscL: this.binOscL,
      binOscR: this.binOscR,
      binGainL: this.binGainL,
      binGainR: this.binGainR,
      stereoOsc: this.stereoOsc,
      stereoGain: this.stereoGain,
      stereoLfo: this.stereoLfo,
      stereoLfoGain: this.stereoLfoGain,
      fmLfo: this.fmLfo,
      fmLfoDepth: this.fmLfoDepth,
      noiseSourceL: this.noiseSourceL,
      noiseSourceR: this.noiseSourceR,
      noiseFilterL: this.noiseFilterL,
      noiseFilterR: this.noiseFilterR,
      noiseFilterDepth: this.noiseFilterDepth,
      noiseBlendGain: this.noiseBlendGain,
      noisePanL: this.noisePanL,
      noisePanR: this.noisePanR,
      masterGain: this.masterGain,
    };
  }

  disconnectGraph(graph = this.nodes) {
    Object.values(graph).forEach((node) => {
      if (node && typeof node.disconnect === 'function') {
        try { node.disconnect(); } catch (error) { /* already disconnected */ }
      }
    });
  }

  start() {
    if (this.started) return;
    if (!this.ctx) this.init();
    if (this.needsRebuild) {
      this.disconnectGraph();
      this.nodes = {};
      this.buildGraph();
      this.needsRebuild = false;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const t = this.ctx.currentTime;
    const o = this.nodes;
    o.carrierOsc.start(t);
    o.amLfo.start(t);
    o.binOscL.start(t);
    o.binOscR.start(t);
    o.stereoOsc.start(t);
    o.stereoLfo.start(t);
    o.fmLfo.start(t);
    o.noiseSourceL.start(t);
    o.noiseSourceR.start(t);
    this.started = true;
  }

  stop() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const o = this.nodes;
    try {
      o.carrierOsc.stop(t);
      o.amLfo.stop(t);
      o.binOscL.stop(t);
      o.binOscR.stop(t);
      o.stereoOsc.stop(t);
      o.stereoLfo.stop(t);
      o.fmLfo.stop(t);
      o.noiseSourceL.stop(t);
      o.noiseSourceR.stop(t);
    } catch (error) {
      // nodes may already be stopped during teardown
    }
    this.started = false;
    this.needsRebuild = true;
  }

  updateCarrier(freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const filterCenter = Math.min(Math.max(freq, 20), this.ctx.sampleRate * 0.45);
    rampTo(this.nodes.carrierOsc.frequency, freq, t);
    rampTo(this.nodes.binOscL.frequency, freq, t);
    rampTo(this.nodes.binOscR.frequency, freq + this.state.brainwave, t);
    rampTo(this.nodes.stereoOsc.frequency, freq, t);
    rampTo(this.nodes.noiseFilterL.frequency, filterCenter, t);
    rampTo(this.nodes.noiseFilterR.frequency, filterCenter, t);
    rampTo(this.nodes.noiseFilterDepth.gain, noiseFilterDepthValue(freq, this.state.fmod, this.ctx.sampleRate), t);
  }

  updateBrainwave(freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    rampTo(this.nodes.amLfo.frequency, freq, t);
    rampTo(this.nodes.stereoLfo.frequency, freq, t);
    rampTo(this.nodes.fmLfo.frequency, freq, t);
    rampTo(this.nodes.binOscR.frequency, this.state.carrier + freq, t);
  }

  updateModLevels() {
    if (!this.ctx) return;
    const state = this.state;
    const t = this.ctx.currentTime;
    const o = this.nodes;
    rampTo(o.amLfoGain.gain, state.amod / 100, t);
    const binLevel = state.binaural / 100 * 0.5;
    rampTo(o.binGainL.gain, binLevel, t);
    rampTo(o.binGainR.gain, binLevel, t);
    rampTo(o.stereoGain.gain, state.stereo / 100 * 0.5, t);
    rampTo(o.stereoLfoGain.gain, state.stereo / 100, t);
    rampTo(o.fmLfoDepth.gain, state.fmod / 100 * 20, t);
    rampTo(o.carrierGain.gain, 0.25 * (1 - state.noise / 100), t);
    rampTo(o.noiseBlendGain.gain, 0.25 * (state.noise / 100), t);
    rampTo(o.noiseFilterDepth.gain, noiseFilterDepthValue(state.carrier, state.fmod, this.ctx.sampleRate), t);
    rampTo(o.masterGain.gain, state.mix / 100 * 0.5, t);
  }
}
