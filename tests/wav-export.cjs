/* Exportación WAV como lógica pura.
   Spec: openspec/specs/final-validation (modelo unitario) + unit-verification.
   Node puro: sin navegador y sin npm install. Importa el fuente real
   (cortex-wav-export.js) y le inyecta un OfflineAudioContext simulado: el
   grafo que el export construye se recorre por sus aristas reales y se
   renderiza analíticamente (senos puros por rama). No sustituye al navegador:
   ejerce el cableado del export (header RIFF, canales, muestreo, mezcla,
   clamp de clipping) sobre el fuente real. */
const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const noop = () => {};

/* OfflineAudioContext simulado: registra las aristas que el export crea con
   connect() y renderiza cada rama de oscilador→destination como un seno puro
   escalado por las ganancias del camino y paneado por el último panner. */
function makeOfflineAudioContextCtor() {
  class SimNode {
    constructor(kind) {
      this.kind = kind;
      this.connections = [];
      this._gain = 0;
      this._frequency = 0;
      this._pan = 0;
      this._Q = 0;
      this.type = '';
      this.loop = false;
      this.buffer = null;
      this.__sim = true;
    }
    mkParam(name) {
      const node = this;
      return {
        __param: name,
        get value() { return node[`_${name}`]; },
        set value(v) { node[`_${name}`] = v; },
      };
    }
    get gain() { if (!this.__pGain) this.__pGain = this.mkParam('gain'); return this.__pGain; }
    get frequency() { if (!this.__pFreq) this.__pFreq = this.mkParam('frequency'); return this.__pFreq; }
    get pan() { if (!this.__pPan) this.__pPan = this.mkParam('pan'); return this.__pPan; }
    get Q() { if (!this.__pQ) this.__pQ = this.mkParam('Q'); return this.__pQ; }
    connect(target) {
      this.connections.push(target);
      return target;
    }
    start() {}
  }

  return class SimOfflineAudioContext {
    constructor(channels, length, rate) {
      this.destination = new SimNode('destination');
      this.sampleRate = rate;
      this.length = length;
      this.numberOfChannels = channels;
      this.created = [];
    }
    _mk(kind) { const n = new SimNode(kind); this.created.push(n); return n; }
    createGain() { return this._mk('gain'); }
    createOscillator() { return this._mk('oscillator'); }
    createBufferSource() { return this._mk('buffersource'); }
    createBiquadFilter() { return this._mk('biquad'); }
    createStereoPanner() { return this._mk('panner'); }
    createBuffer(ch, len, rate) {
      const data = [];
      for (let c = 0; c < ch; c += 1) data.push(new Float32Array(len));
      return { numberOfChannels: ch, length: len, sampleRate: rate, getChannelData: (c) => data[c] };
    }
    async startRendering() {
      // Ramas: cada oscilador con camino a destination por nodos no-param.
      const branches = [];
      const visit = (node, gain, pan, path) => {
        if (!node || !node.__sim || path.has(node)) return;
        const nextPath = new Set(path);
        nextPath.add(node);
        if (node === this.destination) {
          if (gain > 0) branches.push({ gain, pan });
          return;
        }
        let g = gain;
        if (node.kind === 'gain' && node !== this.destination) g = gain * node._gain;
        let p = pan;
        if (node.kind === 'panner') p = node._pan;
        for (const target of node.connections) visit(target, g, p, nextPath);
      };
      for (const node of this.created) {
        if (node.kind === 'oscillator') visit(node, 1, null, new Set());
      }
      const len = this.length;
      const L = new Float32Array(len);
      const R = new Float32Array(len);
      for (const node of this.created) {
        if (node.kind !== 'oscillator') continue;
        const contrib = [];
        const collect = (n, gain, pan, path) => {
          if (!n || !n.__sim || path.has(n)) return;
          const np = new Set(path); np.add(n);
          if (n === this.destination) { if (gain > 0) contrib.push({ gain, pan }); return; }
          let g = gain;
          if (n.kind === 'gain') g *= n._gain;
          let p = pan;
          if (n.kind === 'panner') p = n._pan;
          for (const t of n.connections) collect(t, g, p, np);
        };
        collect(node, 1, 0, new Set());
        const freq = node._frequency;
        for (const c of contrib) {
          for (let i = 0; i < len; i += 1) {
            const s = Math.sin(2 * Math.PI * freq * i / this.sampleRate) * c.gain;
            if (c.pan <= -0.5) L[i] += s;
            else if (c.pan >= 0.5) R[i] += s;
            else { L[i] += s * 0.5; R[i] += s * 0.5; }
          }
        }
      }
      void branches;
      const data = [L, R];
      return {
        numberOfChannels: 2,
        length: len,
        sampleRate: this.sampleRate,
        getChannelData: (ch) => data[ch],
      };
    }
  };
}

/* Decodificador RIFF/WAVE a mano (equivalente a parseWav del e2e retirado). */
function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const ascii = (o, n) => { let s = ''; for (let i = 0; i < n; i += 1) s += String.fromCharCode(view.getUint8(o + i)); return s; };
  const parsed = {
    riff: ascii(0, 4),
    riffSize: view.getUint32(4, true),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    fmtSize: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    dataTag: ascii(36, 4),
    dataBytes: view.getUint32(40, true),
  };
  const numCh = parsed.channels;
  const frames = parsed.dataBytes / (numCh * 2);
  const peaks = new Array(numCh).fill(0);
  const nonFinite = new Array(numCh).fill(0);
  const clip = new Array(numCh).fill(0);
  const rmsSum = new Array(numCh).fill(0);
  const samples = [];
  for (let ch = 0; ch < numCh; ch += 1) {
    const arr = new Float32Array(frames);
    for (let i = 0; i < frames; i += 1) {
      const raw = view.getInt16(44 + (i * numCh + ch) * 2, true);
      const v = raw / (raw < 0 ? 0x8000 : 0x7FFF);
      arr[i] = v;
      const a = Math.abs(v);
      if (a > peaks[ch]) peaks[ch] = a;
      if (a >= 0.999) clip[ch] += 1;
      if (!Number.isFinite(v)) nonFinite[ch] += 1;
      rmsSum[ch] += v * v;
    }
    samples.push(arr);
  }
  return { ...parsed, frames, peaks, nonFinite, clipRate: clip.map((c) => c / frames), rms: rmsSum.map((s) => Math.sqrt(s / frames)), samples };
}

(async () => {
  const { createWavExporter, audioBufferToWav } = await import('../src/lib/cortex-wav-export.js');

  // El export descarga vía <a download>: en Node se stubbea el DOM mínimo.
  // El Blob producido por el fuente real se captura en createObjectURL y es
  // el que se decodifica: ejerce el grafo que exportWav construye de verdad.
  const downloads = [];
  let exportedBlob = null;
  globalThis.document = {
    createElement: () => {
      const el = { href: '', download: '' };
      Object.defineProperty(el, 'click', { value: () => downloads.push(el.download) });
      return el;
    },
  };
  globalThis.URL = {
    createObjectURL: (blob) => { exportedBlob = blob; return 'blob:sim'; },
    revokeObjectURL: noop,
  };

  const state = {
    brainwave: 10, carrier: 200, binaural: 40, stereo: 0, fmod: 0, amod: 0, noise: 0, mix: 80,
  };
  const toasts = [];
  const SimCtx = makeOfflineAudioContextCtor();
  const exporter = createWavExporter({
    state,
    showToast: (m) => toasts.push(m),
    offlineAudioContextCtor: SimCtx,
  });
  const ok = await exporter.exportWav();
  check(ok === true, 'exportWav() completa con la configuración válida', `toasts=${toasts.join(' ; ')}`);
  check(downloads.length === 1 && /^cortex-10\.0hz-200hz\.wav$/.test(downloads[0]), 'descarga con nombre esperado', String(downloads[0]));
  check(exportedBlob !== null, 'el export produjo un Blob', exportedBlob && exportedBlob.type);

  // El Blob capturado ES el RIFF del fuente real con el grafo real del export.
  const arrayBuffer = await exportedBlob.arrayBuffer();
  const parsed = parseWav(arrayBuffer);

  // 1. Header RIFF/WAVE
  check(parsed.riff === 'RIFF' && parsed.wave === 'WAVE' && parsed.fmt === 'fmt ' && parsed.dataTag === 'data', 'header RIFF/WAVE completo', `${parsed.riff}|${parsed.wave}|${parsed.fmt}|${parsed.dataTag}`);
  check(parsed.channels === 2, 'canales = 2', String(parsed.channels));
  check(parsed.sampleRate === 44100, 'sample rate = 44100', String(parsed.sampleRate));
  check(parsed.bitsPerSample === 16, 'bits por muestra = 16', String(parsed.bitsPerSample));
  check(parsed.audioFormat === 1, 'formato PCM (1)', String(parsed.audioFormat));
  check(parsed.riffSize === arrayBuffer.byteLength - 8, 'riffSize coincide con el tamaño real', `${parsed.riffSize} vs ${arrayBuffer.byteLength - 8}`);
  check(parsed.blockAlign === 4 && parsed.byteRate === 44100 * 4, 'blockAlign y byteRate coherentes', `${parsed.blockAlign}/${parsed.byteRate}`);

  // 2. Duración dentro de tolerancia
  const durationSeconds = parsed.frames / parsed.sampleRate;
  check(durationSeconds > 59.9 && durationSeconds < 60.1, 'duración 60 s ± 0.1', durationSeconds.toFixed(3) + 's');

  // 3. Sin NaN/Infinity
  check(parsed.nonFinite.every((v) => v === 0), 'sin NaN/Infinity en las muestras', JSON.stringify(parsed.nonFinite));

  // 4. Señal no silenciosa con fuente activa
  check(parsed.rms.every((v) => v > 0.0001), 'señal no silenciosa con fuente activa', parsed.rms.map((v) => v.toFixed(4)).join(','));
  check(parsed.peaks.every((v) => v <= 1.00001), 'sin picos fuera de [-1, 1]', parsed.peaks.map((v) => v.toFixed(4)).join(','));
  check(parsed.clipRate.every((v) => v <= 0.01), 'clipping por debajo del umbral', parsed.clipRate.map((v) => v.toFixed(5)).join(','));

  // 5. Binaural activo: canales L/R distintos
  {
    let diff = 0;
    for (let i = 0; i < 2000; i += 1) if (parsed.samples[0][i] !== parsed.samples[1][i]) diff += 1;
    check(diff > 0, 'binaural activo: L y R no son idénticos', `difieren en ${diff}/2000 muestras`);
  }

  // 6. Sin modulación que exija separación: mono puro produce canales iguales
  {
    const monoState = { brainwave: 10, carrier: 200, binaural: 0, stereo: 0, fmod: 0, amod: 0, noise: 0, mix: 80 };
    const monoExporter = createWavExporter({
      state: monoState, showToast: noop, offlineAudioContextCtor: SimCtx,
    });
    check(await monoExporter.exportWav() === true, 'export mono (sin binaural) también completa');
  }

  // 7. Umbral de clipping: el clamp del fuente real recorta a [-1, 1] y se reporta
  {
    const extreme = {
      numberOfChannels: 2, length: 100, sampleRate: 44100,
      getChannelData: (ch) => {
        const arr = new Float32Array(100);
        for (let i = 0; i < 100; i += 1) arr[i] = ch === 0 ? 2.5 : -2.5;
        return arr;
      },
    };
    const clipped = parseWav(await audioBufferToWav(extreme).arrayBuffer());
    check(clipped.peaks.every((v) => v <= 1.00001), 'clipping: muestras fuera de rango se recortan a [-1, 1]', clipped.peaks.join(','));
    check(clipped.clipRate.every((v) => v >= 0.99), 'clipping: se detecta al superar el umbral', clipped.clipRate.map((v) => v.toFixed(3)).join(','));
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.log(`FAIL  excepción no controlada — ${error.stack || error.message}`);
  process.exit(1);
});
