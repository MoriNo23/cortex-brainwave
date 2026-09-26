
/* ═══════════════════════════════════════════════════════════════
   CORTEX — Brainwave Entrainment Generator
   ═══════════════════════════════════════════════════════════════ */

/* ── STATE ── */
const state = {
  brainwave: 10,
  carrier: 200,
  amod: 0,
  binaural: 0,
  stereo: 0,
  fmod: 0,
  noise: 0,
  mix: 80,
  playing: false,
  band: 'alpha'
};

/* ── BANDS ── */
const BANDS = {
  delta:  { name:'Delta',   range:'0.5 – 4 Hz',  desc:'Sueño profundo sin sueños. Restauración física, sanación, inconsciencia. El cerebro está en su estado más lento.', regions:['deep'] },
  theta:  { name:'Theta',   range:'4 – 8 Hz',    desc:'Estado de duermevela, sueño REM, meditación profunda. Procesamiento emocional, consolidación de memoria, creatividad.', regions:['temporal','deep'] },
  alpha:  { name:'Alpha',   range:'8 – 12 Hz',   desc:'Relajación despierta. Creatividad, flow, meditación ligera. Predomina con los ojos cerrados pero sin dormir.', regions:['parietal','occipital'] },
  beta:   { name:'Beta',    range:'13 – 30 Hz',  desc:'Pensamiento activo, foco, resolución de problemas. Presente durante trabajo, decisiones, tareas cognitivas.', regions:['frontal'] },
  gamma:  { name:'Gamma',   range:'30+ Hz',      desc:'Procesamiento rápido, aprendizaje, memoria. Sincroniza áreas distantes del cerebro. El estado más rápido.', regions:['frontal','parietal','occipital'] }
};

function bandFromFreq(hz) {
  if (hz < 4)  return 'delta';
  if (hz < 8)  return 'theta';
  if (hz < 13) return 'alpha';
  if (hz < 30) return 'beta';
  return 'gamma';
}

/* ── AUDIO ENGINE (sin cambios en la ruta de audio) ── */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.nodes = {};
    this.started = false;
    this.needsRebuild = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (Object.keys(this.nodes).length > 0) return;
    this.buildGraph();
  }

  buildGraph() {
    const ctx = this.ctx;

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

    this.binGainL = ctx.createGain(); this.binGainR = ctx.createGain();
    this.binGainL.gain.value = 0; this.binGainR.gain.value = 0;
    this.binOscL = ctx.createOscillator(); this.binOscR = ctx.createOscillator();
    this.binOscL.type = 'sine'; this.binOscR.type = 'sine';
    this.binOscL.frequency.value = state.carrier;
    this.binOscR.frequency.value = state.carrier + state.brainwave;
    this.binPanL = ctx.createStereoPanner(); this.binPanR = ctx.createStereoPanner();
    this.binPanL.pan.value = -1; this.binPanR.pan.value = 1;
    this.binOscL.connect(this.binGainL).connect(this.binPanL);
    this.binOscR.connect(this.binGainR).connect(this.binPanR);

    this.stereoGain = ctx.createGain(); this.stereoGain.gain.value = 0;
    this.stereoPanner = ctx.createStereoPanner(); this.stereoPanner.pan.value = 0;
    this.stereoOsc = ctx.createOscillator();
    this.stereoOsc.type = 'sine'; this.stereoOsc.frequency.value = state.carrier;
    this.stereoOsc.connect(this.stereoGain).connect(this.stereoPanner);
    this.stereoLfo = ctx.createOscillator();
    this.stereoLfo.type = 'sine'; this.stereoLfo.frequency.value = state.brainwave;
    this.stereoLfoGain = ctx.createGain(); this.stereoLfoGain.gain.value = 1;
    this.stereoLfo.connect(this.stereoLfoGain);
    this.stereoLfoGain.connect(this.stereoPanner.pan);

    this.fmLfo = ctx.createOscillator();
    this.fmLfo.type = 'sine'; this.fmLfo.frequency.value = state.brainwave;
    this.fmLfoDepth = ctx.createGain(); this.fmLfoDepth.gain.value = 0;
    this.fmLfo.connect(this.fmLfoDepth);
    this.fmLfoDepth.connect(this.carrierOsc.frequency);

    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0;
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer; this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);

    this.amModGain.connect(this.masterGain);
    this.binPanL.connect(this.masterGain);
    this.binPanR.connect(this.masterGain);
    this.stereoPanner.connect(this.masterGain);
    this.noiseGain.connect(this.masterGain);

    this.nodes = {
      carrierOsc: this.carrierOsc, amLfo: this.amLfo, amLfoGain: this.amLfoGain,
      binOscL: this.binOscL, binOscR: this.binOscR,
      binGainL: this.binGainL, binGainR: this.binGainR,
      stereoOsc: this.stereoOsc, stereoGain: this.stereoGain,
      stereoLfo: this.stereoLfo, stereoLfoGain: this.stereoLfoGain,
      fmLfo: this.fmLfo, fmLfoDepth: this.fmLfoDepth,
      noiseSource: this.noiseSource, noiseGain: this.noiseGain,
      masterGain: this.masterGain
    };
  }

  disconnectGraph(graph = this.nodes) {
    Object.values(graph).forEach(node => {
      if (node && typeof node.disconnect === 'function') {
        try { node.disconnect(); } catch (e) { /* already disconnected */ }
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
    const t = this.ctx.currentTime; const o = this.nodes;
    o.carrierOsc.start(t); o.amLfo.start(t);
    o.binOscL.start(t); o.binOscR.start(t);
    o.stereoOsc.start(t); o.stereoLfo.start(t);
    o.fmLfo.start(t); o.noiseSource.start(t);
    this.started = true;
  }

  stop() {
    if (!this.started) return;
    const t = this.ctx.currentTime; const o = this.nodes;
    try {
      o.carrierOsc.stop(t); o.amLfo.stop(t);
      o.binOscL.stop(t); o.binOscR.stop(t);
      o.stereoOsc.stop(t); o.stereoLfo.stop(t);
      o.fmLfo.stop(t); o.noiseSource.stop(t);
    } catch(e) {}
    this.started = false;
    this.needsRebuild = true;
  }

  updateCarrier(freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.nodes.carrierOsc.frequency.linearRampToValueAtTime(freq, t + 0.05);
    this.nodes.binOscL.frequency.linearRampToValueAtTime(freq, t + 0.05);
    this.nodes.binOscR.frequency.linearRampToValueAtTime(freq + state.brainwave, t + 0.05);
    this.nodes.stereoOsc.frequency.linearRampToValueAtTime(freq, t + 0.05);
  }

  updateBrainwave(freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.nodes.amLfo.frequency.linearRampToValueAtTime(freq, t + 0.05);
    this.nodes.stereoLfo.frequency.linearRampToValueAtTime(freq, t + 0.05);
    this.nodes.fmLfo.frequency.linearRampToValueAtTime(freq, t + 0.05);
    this.nodes.binOscR.frequency.linearRampToValueAtTime(state.carrier + freq, t + 0.05);
  }

  updateModLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime; const o = this.nodes;
    o.amLfoGain.gain.linearRampToValueAtTime(state.amod / 100, t + 0.05);
    const binLevel = state.binaural / 100 * 0.5;
    o.binGainL.gain.linearRampToValueAtTime(binLevel, t + 0.05);
    o.binGainR.gain.linearRampToValueAtTime(binLevel, t + 0.05);
    o.stereoGain.gain.linearRampToValueAtTime(state.stereo / 100 * 0.5, t + 0.05);
    o.stereoLfoGain.gain.linearRampToValueAtTime(state.stereo / 100, t + 0.05);
    o.fmLfoDepth.gain.linearRampToValueAtTime(state.fmod / 100 * 20, t + 0.05);
    o.noiseGain.gain.linearRampToValueAtTime(state.noise / 100 * 0.15, t + 0.05);
    o.masterGain.gain.linearRampToValueAtTime(state.mix / 100 * 0.5, t + 0.05);
  }
}

const engine = new AudioEngine();

/* ── WAVEFORM ── */
const waveCanvas = document.getElementById('waveCanvas');
const waveCtx = waveCanvas.getContext('2d');

function resizeWave() {
  const rect = waveCanvas.parentElement.getBoundingClientRect();
  waveCanvas.width = rect.width * 2;
  waveCanvas.height = rect.height * 2;
  waveCanvas.style.width = rect.width + 'px';
  waveCanvas.style.height = rect.height + 'px';
}
window.addEventListener('resize', resizeWave);

let wavePhase = 0;
function drawWaveFrame() {
  const w = waveCanvas.width, h = waveCanvas.height;
  waveCtx.clearRect(0, 0, w, h);

  if (!state.playing) {
    waveCtx.strokeStyle = 'rgba(58,54,46,0.4)';
    waveCtx.lineWidth = 1;
    waveCtx.beginPath();
    waveCtx.moveTo(0, h/2);
    waveCtx.lineTo(w, h/2);
    waveCtx.stroke();
    return;
  }

  const freq = state.brainwave;
  wavePhase += 0.008 * (1 + freq * 0.05);

  waveCtx.strokeStyle = '#E8A855';
  waveCtx.lineWidth = 1.5;
  waveCtx.globalAlpha = 0.7;
  waveCtx.beginPath();

  const points = 300;
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * w;
    const t = i / points * Math.PI * 2;
    const carrierWave = Math.sin(t * 0.8 + wavePhase * 0.3) * 0.4;
    const modWave = Math.sin(t * (1 + freq * 0.02) + wavePhase) * 0.3;
    const am = state.amod > 0 ? (0.5 + 0.5 * Math.sin(t * 2 + wavePhase * 1.5)) : 1;
    const y = h/2 + (carrierWave * am + modWave) * h * 0.35;
    if (i === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();
  waveCtx.globalAlpha = 1;
}

/* ── SPATIAL RADAR ── */
const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas.getContext('2d');
const RADAR_SIZE = 320;
radarCanvas.width = RADAR_SIZE;
radarCanvas.height = RADAR_SIZE;
let radarT0 = performance.now();

function drawRadarFrame(now = performance.now()) {
  const ctx = radarCtx;
  const W = RADAR_SIZE, H = RADAR_SIZE;
  const cx = W/2, cy = H/2;
  const R = W/2 - 26;

  ctx.clearRect(0, 0, W, H);

  const headRx = R * 0.74;
  const headRy = R * 0.92;

  /* distance rings */
  ctx.strokeStyle = 'rgba(58,54,46,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, headRx * i/3, headRy * i/3, 0, 0, Math.PI*2);
    ctx.stroke();
  }

  /* axes */
  ctx.beginPath();
  ctx.moveTo(cx, cy - headRy); ctx.lineTo(cx, cy + headRy);
  ctx.moveTo(cx - headRx, cy); ctx.lineTo(cx + headRx, cy);
  ctx.stroke();

  /* head outline */
  ctx.strokeStyle = '#3A362E';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, headRx, headRy, 0, 0, Math.PI*2);
  ctx.stroke();

  /* nose (front) */
  ctx.fillStyle = '#3A362E';
  ctx.beginPath();
  ctx.moveTo(cx, cy - headRy - 10);
  ctx.lineTo(cx - 7, cy - headRy + 3);
  ctx.lineTo(cx + 7, cy - headRy + 3);
  ctx.closePath();
  ctx.fill();

  /* ears */
  ctx.beginPath(); ctx.ellipse(cx - headRx - 2, cy, 4, 9, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + headRx + 2, cy, 4, 9, 0, 0, Math.PI*2); ctx.fill();

  /* labels */
  ctx.fillStyle = '#6B6358';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FRENTE', cx, cy - headRy - 16);
  ctx.fillText('ATRÁS', cx, cy + headRy + 22);
  ctx.textAlign = 'left';
  ctx.fillText('IZQ', cx - headRx - 28, cy + 4);
  ctx.textAlign = 'right';
  ctx.fillText('DER', cx + headRx + 28, cy + 4);
  ctx.textAlign = 'center';

  /* modulation amounts */
  const stereoAmt = state.stereo / 100;
  const fmodAmt   = state.fmod / 100;
  const binAmt    = state.binaural / 100;
  const amodAmt   = state.amod / 100;
  const noiseAmt  = state.noise / 100;

  const t = (now - radarT0) / 1000;
  const phase = t * Math.max(state.brainwave, 0.5) * Math.PI;

  if (state.playing) {
    /* perception field — stereo: horizontal band */
    if (stereoAmt > 0.03) {
      const ry = headRy * (0.22 + 0.45 * stereoAmt);
      ctx.fillStyle = `rgba(232,168,85,${0.05 + 0.12 * stereoAmt})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, headRx, ry, 0, 0, Math.PI*2);
      ctx.fill();
    }
    /* f-mod: vertical band (front-back) */
    if (fmodAmt > 0.03) {
      const rx = headRx * (0.22 + 0.45 * fmodAmt);
      ctx.fillStyle = `rgba(74,155,142,${0.05 + 0.12 * fmodAmt})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, headRy, 0, 0, Math.PI*2);
      ctx.fill();
    }
    /* binaural: two lobes at the ears */
    if (binAmt > 0.03) {
      ctx.fillStyle = `rgba(232,168,85,${0.07 + 0.12 * binAmt})`;
      const lx = headRx * (0.45 + 0.25 * binAmt);
      const ly = headRy * (0.35 + 0.2 * binAmt);
      ctx.beginPath(); ctx.ellipse(cx - lx, cy, headRx*0.28, ly, 0, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + lx, cy, headRx*0.28, ly, 0, 0, Math.PI*2); ctx.fill();
    }
    /* noise: diffuse cloud */
    if (noiseAmt > 0.03) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI*2 + t * 0.6;
        const rr = 0.3 + 0.55 * ((i * 0.37) % 1);
        ctx.fillStyle = `rgba(160,150,135,${0.03 + noiseAmt * 0.05})`;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * headRx * rr,
                cy + Math.sin(a) * headRy * rr,
                10 + noiseAmt * 14, 0, Math.PI*2);
        ctx.fill();
      }
    }
    /* a-mod: pulsing ring */
    if (amodAmt > 0.03) {
      const pulse = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 2));
      ctx.strokeStyle = `rgba(232,168,85,${0.12 + 0.22 * amodAmt})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, headRx * pulse, headRy * pulse, 0, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  /* source dot — oscillates with stereo (X) and f-mod (Y) */
  let srcX = 0, srcY = 0;
  if (state.playing) {
    srcX = Math.sin(phase) * stereoAmt * 0.85;
    srcY = Math.sin(phase * 0.65 + 1.1) * fmodAmt * 0.75;
  }
  const sx = cx + srcX * headRx;
  const sy = cy + srcY * headRy;

  const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
  grd.addColorStop(0, state.playing ? 'rgba(232,168,85,0.85)' : 'rgba(107,99,88,0.35)');
  grd.addColorStop(1, 'rgba(232,168,85,0)');
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = state.playing ? '#E8A855' : '#6B6358';
  ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI*2); ctx.fill();

  /* center marker */
  ctx.fillStyle = 'rgba(240,235,224,0.25)';
  ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI*2); ctx.fill();
}

/* ── SPATIAL READOUT ── */
function updateSpatialReadout() {
  const parts = [];
  if (state.stereo > 0)   parts.push(`Barrido L↔R ${state.stereo}%`);
  if (state.fmod > 0)     parts.push(`Frente↔Atrás ${state.fmod}%`);
  if (state.binaural > 0) parts.push(`Ancho binaural ${state.binaural}%`);
  if (state.amod > 0)     parts.push(`Pulso ${state.amod}%`);
  if (state.noise > 0)    parts.push(`Difusión ${state.noise}%`);

  const el = document.getElementById('spatialReadout');
  el.innerHTML = parts.length
    ? parts.map(p => `<span class="spatial-chip">${p}</span>`).join('')
    : '<span class="spatial-chip muted">Sin modulación espacial — sonido centrado</span>';
}

/* ── BRAIN ── */
function updateBrain() {
  const band = bandFromFreq(state.brainwave);
  state.band = band;

  document.querySelectorAll('.region').forEach(el => el.classList.remove('active', 'teal-active'));

  const info = BANDS[band];
  info.regions.forEach(regionName => {
    document.querySelectorAll(`[data-region="${regionName}"]`).forEach(el => {
      el.classList.add('active');
      if (regionName === 'deep') el.classList.add('teal-active');
    });
  });

  document.getElementById('bandName').textContent = info.name;
  document.getElementById('bandRange').textContent = info.range;
  document.getElementById('bandDesc').textContent = info.desc;

  document.querySelectorAll('.preset').forEach(el => {
    el.classList.toggle('active', el.dataset.band === band);
  });

  document.getElementById('statusBand').textContent = 'banda: ' + info.name;
  document.getElementById('statusBeat').textContent = 'beat: ' + state.brainwave.toFixed(1) + ' Hz';

  if (state.playing) {
    const pulse = 0.85 + 0.15 * Math.sin(Date.now() / 1000 * state.brainwave * 0.5);
    document.querySelectorAll('.region.active').forEach(el => { el.style.opacity = pulse; });
  } else {
    document.querySelectorAll('.region').forEach(el => { el.style.opacity = 1; });
  }
}

/* ── PRESETS ── */
function applyPreset(band, freq) {
  state.brainwave = freq;
  document.getElementById('sliderBrainwave').value = freq;
  document.getElementById('valBrainwave').textContent = freq.toFixed(1) + ' Hz';

  const defaults = {
    delta: { amod: 30, binaural: 20, stereo: 0,  fmod: 0,  noise: 10 },
    theta: { amod: 35, binaural: 25, stereo: 10, fmod: 0,  noise: 5 },
    alpha: { amod: 25, binaural: 30, stereo: 15, fmod: 0,  noise: 0 },
    beta:  { amod: 20, binaural: 20, stereo: 10, fmod: 5,  noise: 0 },
    gamma: { amod: 15, binaural: 15, stereo: 10, fmod: 10, noise: 0 }
  };
  const d = defaults[band] || defaults.alpha;
  state.amod = d.amod; state.binaural = d.binaural;
  state.stereo = d.stereo; state.fmod = d.fmod; state.noise = d.noise;

  document.getElementById('sliderAmod').value = d.amod;
  document.getElementById('sliderBinaural').value = d.binaural;
  document.getElementById('sliderStereo').value = d.stereo;
  document.getElementById('sliderFmod').value = d.fmod;
  document.getElementById('sliderNoise').value = d.noise;

  document.getElementById('valAmod').textContent = d.amod + '%';
  document.getElementById('valBinaural').textContent = d.binaural + '%';
  document.getElementById('valStereo').textContent = d.stereo + '%';
  document.getElementById('valFmod').textContent = d.fmod + '%';
  document.getElementById('valNoise').textContent = d.noise + '%';

  engine.updateBrainwave(state.brainwave);
  engine.updateModLevels();
  updateBrain();
  updateSpatialReadout();
  showToast('preset: ' + BANDS[band].name);
}

/* ── GLOSSARY ── */
const GLOSSARY = [
  { term: 'Brainwave (onda cerebral)', body: 'Frecuencia eléctrica del cerebro que querés inducir. No se escucha directamente porque está por debajo de 20 Hz; se "monta" sobre el carrier.' },
  { term: 'Carrier (portadora)', body: 'El tono audible que sí escuchás. Es el vehículo que transporta la frecuencia cerebral. Elegí una que te resulte agradable.' },
  { term: 'a-mod (amplitud)', body: 'Modula el volumen del carrier a la frecuencia cerebral. Crea tonos isocrónicos. Funciona con un solo parlante. En el radar se ve como un anillo que late.' },
  { term: 'binaural', body: 'Divide el carrier en dos tonos: uno para cada oído, con una diferencia igual a la frecuencia cerebral. El beat lo crea tu cerebro. Necesitás auriculares. En el radar se ve como dos lóbulos sobre los oídos.' },
  { term: 'stereo (bilateral)', body: 'Mueve el sonido de izquierda a derecha a la frecuencia cerebral. Crea beats bilaterales. En el radar se ve como una banda horizontal con el punto barriendo L↔R.' },
  { term: 'f-mod (frecuencia)', body: 'Mueve el pitch del carrier alrededor de su frecuencia central. El más audible de los cuatro, pero también el más fatigante. En el radar se muestra como desplazamiento frente↔atrás.' },
  { term: 'Noise (ruido)', body: 'Ruido blanco que se mezcla con el tono. Puede usarse solo o como fondo. En el radar se ve como una nube difusa alrededor de la cabeza.' },
  { term: 'Mix', body: 'Nivel general de salida. Controla el volumen final de todo lo que suena.' },
  { term: 'Bandas cerebrales', body: 'Delta (sueño profundo), Theta (duermevela), Alpha (relajación despierta), Beta (foco), Gamma (procesamiento rápido).' },
  { term: 'Reentrenamiento auditivo', body: 'Técnica que usa un carrier ultrasónico (~14 kHz) con f-mod alto, barriendo frecuencias. Se usa para tinnitus. No está implementado en esta versión.' }
];

function buildGlossary() {
  const container = document.getElementById('glossary');
  container.innerHTML = GLOSSARY.map((g, i) => `
    <div class="gloss-item" data-idx="${i}">
      <div class="gloss-head">
        <span class="gloss-term">${g.term}</span>
        <span class="gloss-toggle">+</span>
      </div>
      <div class="gloss-body"><div class="gloss-body-inner">${g.body}</div></div>
    </div>
  `).join('');

  container.querySelectorAll('.gloss-head').forEach(head => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
  });
}

/* ── TOAST ── */
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ── SAVE / LOAD ── */
function saveSettings() {
  const data = { ...state };
  delete data.playing; delete data.band;
  localStorage.setItem('cortex-settings', JSON.stringify(data));
  showToast('ajustes guardados');
}
function loadSettings() {
  const raw = localStorage.getItem('cortex-settings');
  if (!raw) { showToast('no hay ajustes guardados'); return; }
  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);
    syncUIFromState();
    engine.updateBrainwave(state.brainwave);
    engine.updateCarrier(state.carrier);
    engine.updateModLevels();
    updateBrain();
    updateSpatialReadout();
    showToast('ajustes cargados');
  } catch(e) { showToast('error al cargar'); }
}
function syncUIFromState() {
  document.getElementById('sliderBrainwave').value = state.brainwave;
  document.getElementById('valBrainwave').textContent = state.brainwave.toFixed(1) + ' Hz';
  document.getElementById('sliderCarrier').value = state.carrier;
  document.getElementById('valCarrier').textContent = Math.round(state.carrier) + ' Hz';
  document.getElementById('sliderAmod').value = state.amod;
  document.getElementById('valAmod').textContent = state.amod + '%';
  document.getElementById('sliderBinaural').value = state.binaural;
  document.getElementById('valBinaural').textContent = state.binaural + '%';
  document.getElementById('sliderStereo').value = state.stereo;
  document.getElementById('valStereo').textContent = state.stereo + '%';
  document.getElementById('sliderFmod').value = state.fmod;
  document.getElementById('valFmod').textContent = state.fmod + '%';
  document.getElementById('sliderNoise').value = state.noise;
  document.getElementById('valNoise').textContent = state.noise + '%';
  document.getElementById('sliderMix').value = state.mix;
  document.getElementById('valMix').textContent = state.mix + '%';
}

/* ── .WAV EXPORT ── */
async function exportWav() {
  showToast('renderizando 60s…');
  const duration = 60, sampleRate = 44100;
  const offCtx = new OfflineAudioContext(2, duration * sampleRate, sampleRate);
  const master = offCtx.createGain();
  master.gain.value = state.mix / 100 * 0.5;
  master.connect(offCtx.destination);

  const carrier = offCtx.createOscillator();
  carrier.type = 'sine'; carrier.frequency.value = state.carrier;
  const cGain = offCtx.createGain(); cGain.gain.value = 0.25;
  carrier.connect(cGain);
  const amMod = offCtx.createGain(); amMod.gain.value = 1;
  cGain.connect(amMod);
  const amLfo = offCtx.createOscillator(); amLfo.frequency.value = state.brainwave;
  const amDepth = offCtx.createGain(); amDepth.gain.value = state.amod / 100;
  amLfo.connect(amDepth).connect(amMod.gain);

  const binL = offCtx.createOscillator(); const binR = offCtx.createOscillator();
  binL.frequency.value = state.carrier;
  binR.frequency.value = state.carrier + state.brainwave;
  const bGL = offCtx.createGain(); bGL.gain.value = state.binaural / 100 * 0.5;
  const bGR = offCtx.createGain(); bGR.gain.value = state.binaural / 100 * 0.5;
  const pL = offCtx.createStereoPanner(); pL.pan.value = -1;
  const pR = offCtx.createStereoPanner(); pR.pan.value = 1;
  binL.connect(bGL).connect(pL).connect(master);
  binR.connect(bGR).connect(pR).connect(master);

  const stOsc = offCtx.createOscillator(); stOsc.frequency.value = state.carrier;
  const stG = offCtx.createGain(); stG.gain.value = state.stereo / 100 * 0.5;
  const stP = offCtx.createStereoPanner();
  const stLfo = offCtx.createOscillator(); stLfo.frequency.value = state.brainwave;
  const stDepth = offCtx.createGain(); stDepth.gain.value = state.stereo / 100;
  stLfo.connect(stDepth).connect(stP.pan);
  stOsc.connect(stG).connect(stP).connect(master);

  const fmLfo = offCtx.createOscillator(); fmLfo.frequency.value = state.brainwave;
  const fmDepth = offCtx.createGain(); fmDepth.gain.value = state.fmod / 100 * 20;
  fmLfo.connect(fmDepth).connect(carrier.frequency);

  const noiseBuf = offCtx.createBuffer(1, 2 * sampleRate, sampleRate);
  const nData = noiseBuf.getChannelData(0);
  for (let i = 0; i < nData.length; i++) nData[i] = Math.random() * 2 - 1;
  const noiseSrc = offCtx.createBufferSource();
  noiseSrc.buffer = noiseBuf; noiseSrc.loop = true;
  const nGain = offCtx.createGain(); nGain.gain.value = state.noise / 100 * 0.15;
  noiseSrc.connect(nGain).connect(master);
  amMod.connect(master);

  const t = 0;
  carrier.start(t); amLfo.start(t);
  binL.start(t); binR.start(t);
  stOsc.start(t); stLfo.start(t);
  fmLfo.start(t); noiseSrc.start(t);

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
  } catch(e) { showToast('error al renderizar'); console.error(e); }
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels;
  const length = buffer.length * numCh * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
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
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let sample = buffer.getChannelData(ch)[i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/* ── EVENTS ── */
function bindEvents() {
  const sBw = document.getElementById('sliderBrainwave');
  sBw.addEventListener('input', () => {
    state.brainwave = parseFloat(sBw.value);
    document.getElementById('valBrainwave').textContent = state.brainwave.toFixed(1) + ' Hz';
    engine.updateBrainwave(state.brainwave);
    updateBrain();
  });

  const sC = document.getElementById('sliderCarrier');
  sC.addEventListener('input', () => {
    state.carrier = parseFloat(sC.value);
    document.getElementById('valCarrier').textContent = Math.round(state.carrier) + ' Hz';
    engine.updateCarrier(state.carrier);
  });

  const bindMod = (id, key, valId) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      state[key] = parseFloat(el.value);
      document.getElementById(valId).textContent = state[key] + '%';
      engine.updateModLevels();
      updateSpatialReadout();
    });
  };
  bindMod('sliderAmod', 'amod', 'valAmod');
  bindMod('sliderBinaural', 'binaural', 'valBinaural');
  bindMod('sliderStereo', 'stereo', 'valStereo');
  bindMod('sliderFmod', 'fmod', 'valFmod');
  bindMod('sliderNoise', 'noise', 'valNoise');
  bindMod('sliderMix', 'mix', 'valMix');

  document.querySelectorAll('.preset').forEach(el => {
    el.addEventListener('click', () => applyPreset(el.dataset.band, parseFloat(el.dataset.freq)));
  });

  document.getElementById('btnPlay').addEventListener('click', () => {
    const btn = document.getElementById('btnPlay');
    if (state.playing) {
      engine.stop();
      state.playing = false;
      btn.textContent = '▶ Iniciar';
      btn.classList.add('primary');
      document.getElementById('statusDot').classList.remove('on');
      document.getElementById('statusText').textContent = 'detenido';
    } else {
      engine.start();
      state.playing = true;
      btn.textContent = '■ Detener';
      btn.classList.remove('primary');
      document.getElementById('statusDot').classList.add('on');
      document.getElementById('statusText').textContent = 'reproduciendo';
      engine.updateBrainwave(state.brainwave);
      engine.updateCarrier(state.carrier);
      engine.updateModLevels();
      updateBrain();
    }
  });

  document.getElementById('btnSaveLocal').addEventListener('click', saveSettings);
  document.getElementById('btnLoadLocal').addEventListener('click', loadSettings);
  document.getElementById('btnSave').addEventListener('click', saveSettings);
  document.getElementById('btnLoad').addEventListener('click', loadSettings);
  document.getElementById('btnWav').addEventListener('click', exportWav);

  document.getElementById('toggleMods').addEventListener('click', () => {
    const body = document.getElementById('modsBody');
    const toggle = document.getElementById('toggleMods');
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? 'block' : 'none';
    toggle.textContent = hidden ? '▼' : '▶';
  });

  document.querySelectorAll('.region').forEach(el => {
    el.addEventListener('click', () => {
      const region = el.dataset.region;
      const regionNames = {
        frontal: 'Lóbulo frontal — planificación, foco, movimiento voluntario.',
        parietal: 'Lóbulo parietal — integración sensorial, atención, orientación espacial.',
        temporal: 'Lóbulo temporal — audición, memoria, procesamiento emocional.',
        occipital: 'Lóbulo occipital — procesamiento visual.',
        deep: 'Estructuras profundas — sistema límbico, tronco encefálico. Asociado a estados de sueño profundo.'
      };
      showToast(regionNames[region] || region);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('btnPlay').click();
    }
  });
}

/* ── RENDER LOOP ── */
function renderLoop() {
  drawWaveFrame();
  drawRadarFrame();
  requestAnimationFrame(renderLoop);
}

/* ── INIT ── */
function init() {
  buildGlossary();
  bindEvents();
  resizeWave();
  updateBrain();
  syncUIFromState();
  updateSpatialReadout();
  radarT0 = performance.now();
  requestAnimationFrame(renderLoop);
  setInterval(() => { if (state.playing) updateBrain(); }, 100);
}


/* ── TEST EXPORT ── */
window.__CORTEX__ = {
  state, engine, BANDS, bandFromFreq,
  drawRadarFrame, drawWaveFrame, updateBrain,
  applyPreset, updateSpatialReadout, saveSettings, loadSettings,
  syncUIFromState, RADAR_SIZE, getRadarStart: () => radarT0
};

init();
