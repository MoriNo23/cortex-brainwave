const WAVE_REFERENCE_FRAME_MS = 1000 / 60;
export const RADAR_SIZE = 320;

export function createVisualizers({ state }) {
  const waveCanvas = document.getElementById('waveCanvas');
  const waveCtx = waveCanvas.getContext('2d');
  const radarCanvas = document.getElementById('radarCanvas');
  const radarCtx = radarCanvas.getContext('2d');

  radarCanvas.width = RADAR_SIZE;
  radarCanvas.height = RADAR_SIZE;

  let waveElapsedMs = 0;
  let waveLastTs = null;
  let radarT0 = performance.now();

  function resizeWave() {
    const rect = waveCanvas.parentElement.getBoundingClientRect();
    waveCanvas.width = rect.width * 2;
    waveCanvas.height = rect.height * 2;
    waveCanvas.style.width = `${rect.width}px`;
    waveCanvas.style.height = `${rect.height}px`;
  }

  /* La fase se deriva del tiempo transcurrido, no de la cantidad de frames
     renderizados: a 120 Hz la onda no corre al doble que a 60 Hz. */
  function drawWaveFrame(ts) {
    const now = typeof ts === 'number' ? ts : performance.now();
    const w = waveCanvas.width;
    const h = waveCanvas.height;
    waveCtx.clearRect(0, 0, w, h);

    if (!state.playing) {
      waveElapsedMs = 0;
      waveLastTs = null;
      waveCtx.strokeStyle = 'rgba(28,27,24,0.35)';
      waveCtx.lineWidth = 1;
      waveCtx.beginPath();
      waveCtx.moveTo(0, h / 2);
      waveCtx.lineTo(w, h / 2);
      waveCtx.stroke();
      return;
    }

    if (waveLastTs === null) waveLastTs = now;
    waveElapsedMs += now - waveLastTs;
    waveLastTs = now;

    const freq = state.brainwave;
    const phasePerMs = (0.008 * (1 + freq * 0.05)) / WAVE_REFERENCE_FRAME_MS;
    const wavePhase = waveElapsedMs * phasePerMs;

    waveCtx.strokeStyle = '#b3492f';
    waveCtx.lineWidth = 1.5;
    waveCtx.globalAlpha = 0.7;
    waveCtx.beginPath();

    const points = 300;
    for (let i = 0; i <= points; i += 1) {
      const x = (i / points) * w;
      const t = i / points * Math.PI * 2;
      const carrierWave = Math.sin(t * 0.8 + wavePhase * 0.3) * 0.4;
      const modWave = Math.sin(t * (1 + freq * 0.02) + wavePhase) * 0.3;
      const am = state.amod > 0 ? (0.5 + 0.5 * Math.sin(t * 2 + wavePhase * 1.5)) : 1;
      const y = h / 2 + (carrierWave * am + modWave) * h * 0.35;
      if (i === 0) waveCtx.moveTo(x, y);
      else waveCtx.lineTo(x, y);
    }
    waveCtx.stroke();
    waveCtx.globalAlpha = 1;
  }

  function drawRadarFrame(now = performance.now()) {
    const ctx = radarCtx;
    const W = RADAR_SIZE;
    const H = RADAR_SIZE;
    const cx = W / 2;
    const cy = H / 2;
    const R = W / 2 - 26;

    ctx.clearRect(0, 0, W, H);

    const headRx = R * 0.74;
    const headRy = R * 0.92;

    ctx.strokeStyle = 'rgba(28,27,24,0.30)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i += 1) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, (headRx * i) / 3, (headRy * i) / 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy - headRy);
    ctx.lineTo(cx, cy + headRy);
    ctx.moveTo(cx - headRx, cy);
    ctx.lineTo(cx + headRx, cy);
    ctx.stroke();

    ctx.strokeStyle = '#4a4842';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#4a4842';
    ctx.beginPath();
    ctx.moveTo(cx, cy - headRy - 10);
    ctx.lineTo(cx - 7, cy - headRy + 3);
    ctx.lineTo(cx + 7, cy - headRy + 3);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(cx - headRx - 2, cy, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + headRx + 2, cy, 4, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#85806f';
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FRENTE', cx, cy - headRy - 16);
    ctx.fillText('ATRÁS', cx, cy + headRy + 22);
    ctx.textAlign = 'left';
    ctx.fillText('IZQ', cx - headRx - 28, cy + 4);
    ctx.textAlign = 'right';
    ctx.fillText('DER', cx + headRx + 28, cy + 4);
    ctx.textAlign = 'center';

    const stereoAmt = state.stereo / 100;
    const fmodAmt = state.fmod / 100;
    const binAmt = state.binaural / 100;
    const amodAmt = state.amod / 100;
    const noiseAmt = state.noise / 100;

    const t = (now - radarT0) / 1000;
    const phase = t * Math.max(state.brainwave, 0.5) * Math.PI;

    if (state.playing) {
      if (stereoAmt > 0.03) {
        const ry = headRy * (0.22 + 0.45 * stereoAmt);
        ctx.fillStyle = `rgba(179,73,47,${0.06 + 0.14 * stereoAmt})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, headRx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (fmodAmt > 0.03) {
        const rx = headRx * (0.22 + 0.45 * fmodAmt);
        ctx.fillStyle = `rgba(47,111,98,${0.06 + 0.14 * fmodAmt})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, headRy, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (binAmt > 0.03) {
        ctx.fillStyle = `rgba(179,73,47,${0.08 + 0.14 * binAmt})`;
        const lx = headRx * (0.45 + 0.25 * binAmt);
        const ly = headRy * (0.35 + 0.2 * binAmt);
        ctx.beginPath();
        ctx.ellipse(cx - lx, cy, headRx * 0.28, ly, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + lx, cy, headRx * 0.28, ly, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (noiseAmt > 0.03) {
        for (let i = 0; i < 14; i += 1) {
          const a = (i / 14) * Math.PI * 2 + t * 0.6;
          const rr = 0.3 + 0.55 * ((i * 0.37) % 1);
          ctx.fillStyle = `rgba(133,128,111,${0.04 + noiseAmt * 0.06})`;
          ctx.beginPath();
          ctx.arc(
            cx + Math.cos(a) * headRx * rr,
            cy + Math.sin(a) * headRy * rr,
            10 + noiseAmt * 14,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      if (amodAmt > 0.03) {
        const pulse = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 2));
        ctx.strokeStyle = `rgba(179,73,47,${0.14 + 0.26 * amodAmt})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, headRx * pulse, headRy * pulse, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    let srcX = 0;
    let srcY = 0;
    if (state.playing) {
      srcX = Math.sin(phase) * stereoAmt * 0.85;
      srcY = Math.sin(phase * 0.65 + 1.1) * fmodAmt * 0.75;
    }
    const sx = cx + srcX * headRx;
    const sy = cy + srcY * headRy;

    const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, 18);
    grd.addColorStop(0, state.playing ? 'rgba(179,73,47,0.85)' : 'rgba(133,128,111,0.40)');
    grd.addColorStop(1, 'rgba(179,73,47,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = state.playing ? '#b3492f' : '#85806f';
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(28,27,24,0.30)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function getRadarStart() {
    return radarT0;
  }

  function setRadarStart(value) {
    radarT0 = value;
  }

  function getWavePhaseState() {
    return { elapsedMs: waveElapsedMs, lastTs: waveLastTs };
  }

  return {
    RADAR_SIZE,
    drawRadarFrame,
    drawWaveFrame,
    getRadarStart,
    getWavePhaseState,
    resizeWave,
    setRadarStart,
  };
}
