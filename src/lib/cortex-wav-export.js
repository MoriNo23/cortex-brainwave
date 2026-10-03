import { noiseFilterDepthValue } from './cortex-audio-engine.js';

const WAV_DURATION_SECONDS = 60;
const WAV_SAMPLE_RATE = 44100;

function resolveOfflineAudioContextCtor() {
  const scope = globalThis;
  return scope.OfflineAudioContext || scope.webkitOfflineAudioContext || scope.window?.OfflineAudioContext || scope.window?.webkitOfflineAudioContext || null;
}

export function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const length = buffer.length * numCh * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, length - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length - 44, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let ch = 0; ch < numCh; ch += 1) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export function createWavExporter({ state, showToast, offlineAudioContextCtor = null } = {}) {
  async function exportWav() {
    showToast('renderizando 60s…');
    const OfflineAudioContextCtor = offlineAudioContextCtor || resolveOfflineAudioContextCtor();
    if (!OfflineAudioContextCtor) {
      showToast('OfflineAudioContext no disponible');
      return false;
    }

    const duration = WAV_DURATION_SECONDS;
    const sampleRate = WAV_SAMPLE_RATE;
    const offCtx = new OfflineAudioContextCtor(2, duration * sampleRate, sampleRate);
    const master = offCtx.createGain();
    master.gain.value = state.mix / 100 * 0.5;
    master.connect(offCtx.destination);

    const noiseAmount = state.noise / 100;
    const carrier = offCtx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = state.carrier;
    const cGain = offCtx.createGain();
    cGain.gain.value = 0.25 * (1 - noiseAmount);
    carrier.connect(cGain);
    const amMod = offCtx.createGain();
    amMod.gain.value = 1;
    cGain.connect(amMod);
    const amLfo = offCtx.createOscillator();
    amLfo.frequency.value = state.brainwave;
    const amDepth = offCtx.createGain();
    amDepth.gain.value = state.amod / 100;
    amLfo.connect(amDepth).connect(amMod.gain);

    const noiseBufferL = offCtx.createBuffer(1, 2 * sampleRate, sampleRate);
    const noiseBufferR = offCtx.createBuffer(1, 2 * sampleRate, sampleRate);
    const noiseDataL = noiseBufferL.getChannelData(0);
    const noiseDataR = noiseBufferR.getChannelData(0);
    for (let i = 0; i < noiseDataL.length; i += 1) {
      noiseDataL[i] = Math.random() * 2 - 1;
      noiseDataR[i] = Math.random() * 2 - 1;
    }
    const noiseSrcL = offCtx.createBufferSource();
    const noiseSrcR = offCtx.createBufferSource();
    noiseSrcL.buffer = noiseBufferL;
    noiseSrcL.loop = true;
    noiseSrcR.buffer = noiseBufferR;
    noiseSrcR.loop = true;
    const noiseFilterL = offCtx.createBiquadFilter();
    const noiseFilterR = offCtx.createBiquadFilter();
    for (const filter of [noiseFilterL, noiseFilterR]) {
      filter.type = 'bandpass';
      filter.frequency.value = state.carrier;
      filter.Q.value = 2;
    }
    const noisePanL = offCtx.createStereoPanner();
    noisePanL.pan.value = -1;
    const noisePanR = offCtx.createStereoPanner();
    noisePanR.pan.value = 1;
    const noiseBlend = offCtx.createGain();
    noiseBlend.gain.value = 0.25 * noiseAmount;
    noiseSrcL.connect(noiseFilterL).connect(noisePanL).connect(noiseBlend);
    noiseSrcR.connect(noiseFilterR).connect(noisePanR).connect(noiseBlend);
    noiseBlend.connect(amMod);

    const noiseFilterDepth = offCtx.createGain();
    noiseFilterDepth.gain.value = noiseFilterDepthValue(state.carrier, state.fmod, sampleRate);
    const noiseFmLfo = offCtx.createOscillator();
    noiseFmLfo.frequency.value = state.brainwave;
    noiseFmLfo.connect(noiseFilterDepth);
    noiseFilterDepth.connect(noiseFilterL.frequency);
    noiseFilterDepth.connect(noiseFilterR.frequency);

    const binL = offCtx.createOscillator();
    const binR = offCtx.createOscillator();
    binL.frequency.value = state.carrier;
    binR.frequency.value = state.carrier + state.brainwave;
    const bGL = offCtx.createGain();
    bGL.gain.value = state.binaural / 100 * 0.5;
    const bGR = offCtx.createGain();
    bGR.gain.value = state.binaural / 100 * 0.5;
    const pL = offCtx.createStereoPanner();
    pL.pan.value = -1;
    const pR = offCtx.createStereoPanner();
    pR.pan.value = 1;
    binL.connect(bGL).connect(pL).connect(master);
    binR.connect(bGR).connect(pR).connect(master);

    const stOsc = offCtx.createOscillator();
    stOsc.frequency.value = state.carrier;
    const stG = offCtx.createGain();
    stG.gain.value = state.stereo / 100 * 0.5;
    const stP = offCtx.createStereoPanner();
    const stLfo = offCtx.createOscillator();
    stLfo.frequency.value = state.brainwave;
    const stDepth = offCtx.createGain();
    stDepth.gain.value = state.stereo / 100;
    stLfo.connect(stDepth).connect(stP.pan);
    stOsc.connect(stG).connect(stP).connect(master);

    const fmLfo = offCtx.createOscillator();
    fmLfo.frequency.value = state.brainwave;
    const fmDepth = offCtx.createGain();
    fmDepth.gain.value = state.fmod / 100 * 20;
    fmLfo.connect(fmDepth).connect(carrier.frequency);

    amMod.connect(master);

    const t = 0;
    carrier.start(t); amLfo.start(t);
    binL.start(t); binR.start(t);
    stOsc.start(t); stLfo.start(t);
    fmLfo.start(t); noiseFmLfo.start(t); noiseSrcL.start(t); noiseSrcR.start(t);

    try {
      const rendered = await offCtx.startRendering();
      const wavBlob = audioBufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cortex-${state.brainwave.toFixed(1)}hz-${Math.round(state.carrier)}hz.wav`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('wav descargado');
      return true;
    } catch (error) {
      showToast('error al renderizar');
      console.error(error);
      return false;
    }
  }

  return { exportWav };
}
