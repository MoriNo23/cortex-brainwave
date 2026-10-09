/* Ventana flotante del estrobo (Picture-in-Picture).

   El mini player "de toda la vida" (`.strobe-panel[data-strobe-presentation="mini"]`)
   vive dentro del documento: si cambias de pestaña, el navegador congela
   `requestAnimationFrame` y la luz se queda petrificada en el último fotograma.
   Para que el estrobo siga visible al cambiar de pestaña hace falta una ventana
   propia, que es justo lo que hace un reproductor de vídeo con PiP.

   Dos rutas, en este orden:

   1. **Document Picture-in-Picture** (Chrome/Edge/Opera 116+). Se abre una
      ventana real, siempre encima, y se *mueve* el panel del estrobo ahí dentro.
      El bucle corre con el `requestAnimationFrame` de esa ventana, que sigue
      vivo aunque la pestaña principal esté oculta: es la ruta completa.
   2. **PiP de vídeo** (Firefox/Safari). Un canvas dedicado se pinta desde un
      Worker con `OffscreenCanvas` y se manda a un `<video>` en PiP vía
      `captureStream()`. El Worker no depende de la visibilidad de la pestaña,
      así que el flash continúa. Esta ruta se autoverifica: si el vídeo no
      entrega fotogramas, se cierra y se avisa en vez de dejar un PiP muerto.

   Si ninguna ruta funciona se informa por toast y quien llama activa el mini
   player integrado, que es el comportamiento anterior. */
import {
  STROBE_RAMP_MAX_MS,
  STROBE_RAMP_RATIO,
} from './core-math.js';
import { STROBE_PALETTE } from './cortex-strobe-paint.js';

const PIP_CANVAS_ID = 'strobePipCanvas';
const PIP_VIDEO_ID = 'strobePipVideo';
const PIP_CANVAS_SIZE = 512;
const PIP_FRAME_INTERVAL_MS = 16;
const PIP_FRAME_PROBE_MS = 900;

export function detectStrobePipCapability(target = window) {
  try {
    if (target.documentPictureInPicture && typeof target.documentPictureInPicture.requestWindow === 'function') {
      return { mode: 'document', reason: 'documentPictureInPicture disponible' };
    }
    const video = target.document.createElement('video');
    const canvas = target.document.createElement('canvas');
    const videoPip = target.document.pictureInPictureEnabled === true
      && typeof video.requestPictureInPicture === 'function'
      && typeof canvas.captureStream === 'function';
    if (videoPip) return { mode: 'video', reason: 'PiP de vídeo vía canvas.captureStream' };
    return { mode: 'none', reason: 'el navegador no expone Picture-in-Picture' };
  } catch (error) {
    return { mode: 'none', reason: `sondeo fallido: ${error.message}` };
  }
}

/* El Worker no puede importar módulos, así que su fuente se escribe literal.

   Ojo con la tentación de inyectar `fn.toString()` desde los módulos: el
   bundler renombra las referencias internas y el Worker revienta en runtime con
   `ReferenceError` (una función minificada a `function $(n){return A(n,.5,40)}`
   ya no encuentra `A` fuera de su módulo). Una cadena literal no tiene ese
   problema: es dato, no código referenciado.

   El precio es que la matemática y el pintado están transcritos. La garantía de
   que no divergen no es el nombre, es `tests/strobe-worker.cjs`: ejecuta este
   fuente de verdad y compara su intensidad y su secuencia de operaciones, op por
   op, contra `strobeIntensityWindow` y `paintStrobeSurface`. */
export function buildStrobeWorkerSource() {
  return [
    `const PALETTE = ${JSON.stringify(STROBE_PALETTE)};`,
    `const RAMP_RATIO = ${STROBE_RAMP_RATIO};`,
    `const RAMP_MAX_MS = ${STROBE_RAMP_MAX_MS};`,
    `const HZ_MIN = 0.5;`,
    `const HZ_MAX = 40;`,
    'let canvas = null;',
    'let ctx = null;',
    'let timer = null;',
    'let hz = 10;',
    'let active = false;',
    'let clockOffset = 0;',
    'let painted = 0;',
    'function mainNow() { return clockOffset + self.performance.now(); }',
    'function unit(value) { return value < 0 ? 0 : (value > 1 ? 1 : value); }',
    'function paintSurface(level) {',
    '  const w = canvas.width;',
    '  const h = canvas.height;',
    '  const lv = unit(level);',
    '  const halo = PALETTE.halo;',
    '  const idle = PALETTE.idle;',
    '  const pulse = PALETTE.pulse;',
    '  ctx.clearRect(0, 0, w, h);',
    '  ctx.fillStyle = PALETTE.backdrop;',
    '  ctx.fillRect(0, 0, w, h);',
    '  const haloAlpha = 0.08 + 0.26 * lv;',
    '  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.55);',
    '  gradient.addColorStop(0, `rgba(${halo[0]}, ${halo[1]}, ${halo[2]}, ${haloAlpha.toFixed(3)})`);',
    '  gradient.addColorStop(1, "rgba(5, 6, 10, 0)");',
    '  ctx.fillStyle = gradient;',
    '  ctx.fillRect(0, 0, w, h);',
    '  const size = Math.min(w, h) * 0.48;',
    '  const x = (w - size) / 2;',
    '  const y = (h - size) / 2;',
    '  const r = Math.round(idle[0] + (pulse[0] - idle[0]) * lv);',
    '  const g = Math.round(idle[1] + (pulse[1] - idle[1]) * lv);',
    '  const b = Math.round(idle[2] + (pulse[2] - idle[2]) * lv);',
    '  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;',
    '  ctx.shadowBlur = 40 * lv;',
    '  ctx.shadowColor = `rgba(${halo[0]}, ${halo[1]}, ${halo[2]}, ${(0.12 + 0.63 * lv).toFixed(3)})`;',
    '  ctx.fillRect(x, y, size, size);',
    '  ctx.shadowBlur = 0;',
    '  ctx.strokeStyle = `rgba(255, 255, 255, ${(0.12 + 0.43 * lv).toFixed(3)})`;',
    '  ctx.lineWidth = Math.max(2, Math.round(size * 0.012));',
    '  ctx.strokeRect(x, y, size, size);',
    '}',
    'function paint() {',
    '  if (!ctx) return;',
    '  const safeHz = hz < HZ_MIN ? HZ_MIN : (hz > HZ_MAX ? HZ_MAX : hz);',
    '  const cycleMs = 1000 / safeHz;',
    '  const phase = ((mainNow() % cycleMs) + cycleMs) % cycleMs;',
    '  const t = unit(phase / cycleMs);',
    '  const rampRaw = Math.min(RAMP_RATIO, RAMP_MAX_MS / cycleMs);',
    '  const ramp = rampRaw < 0 ? 0 : (rampRaw > 0.25 ? 0.25 : rampRaw);',
    '  let intensity = 0;',
    '  if (active) {',
    '    if (ramp === 0) intensity = t < 0.5 ? 1 : 0;',
    '    else if (t < ramp) intensity = t / ramp;',
    '    else if (t < 0.5) intensity = 1;',
    '    else if (t < 0.5 + ramp) intensity = 1 - (t - 0.5) / ramp;',
    '  }',
    '  paintSurface(intensity);',
    '  painted += 1;',
    '}',
    'function keepCommitting() {',
    '  /* Con OffscreenCanvas el commit al <canvas> ocurre en el paso de render del',
    '     Worker: mantener un rAF vivo asegura ese paso; el intervalo hace el pintado. */',
    '  if (timer !== null && typeof self.requestAnimationFrame === "function") {',
    '    self.requestAnimationFrame(keepCommitting);',
    '  }',
    '}',
    'self.onmessage = (event) => {',
    '  const data = event.data || {};',
    '  if (data.type === "init") {',
    '    canvas = data.canvas;',
    '    /* El reloj del Worker tiene otro origen que el de la página: se toma el',
    '       desfase al recibir el mensaje para que la fase del flash coincida con',
    '       la del canvas integrado (unos ms de error no se perciben). */',
    '    clockOffset = (data.mainNow || 0) - self.performance.now();',
    '    hz = data.hz || 10;',
    '    active = Boolean(data.active);',
    '    ctx = canvas.getContext("2d");',
    '    paint();',
    '    self.postMessage({ type: "ready" });',
    '    return;',
    '  }',
    '  if (data.type === "params") {',
    '    hz = data.hz || hz;',
    '    active = Boolean(data.active);',
    '    paint();',
    '    return;',
    '  }',
    '  if (data.type === "start") {',
    '    if (timer !== null) return;',
    `    timer = self.setInterval(() => paint(), data.intervalMs || ${PIP_FRAME_INTERVAL_MS});`,
    '    keepCommitting();',
    '    return;',
    '  }',
    '  if (data.type === "stop") {',
    '    if (timer !== null) self.clearInterval(timer);',
    '    timer = null;',
    '    return;',
    '  }',
    '  if (data.type === "frames") {',
    '    self.postMessage({ type: "frames", painted });',
    '    return;',
    '  }',
    '};',
  ].join('\n');
}

export function createStrobePipController({
  getPanel,
  getPlaceholder,
  paintFrame,
  getFrameParams,
  resizeSurface,
  onChange,
  showToast,
}) {
  const capability = detectStrobePipCapability(window);

  let pipWindow = null;
  let pipRafId = 0;
  let pipMode = null;
  let lastError = null;
  let restorePoint = null;

  /* Ruta de vídeo */
  let pipCanvas = null;
  let pipVideo = null;
  let pipWorker = null;
  let pipStream = null;
  let workerPainted = 0;
  let videoFramesSeen = 0;

  function isFloating() {
    return pipMode !== null;
  }

  function getSurfaceDocument() {
    return pipWindow ? pipWindow.document : document;
  }

  function getFloatingInfo() {
    return {
      mode: pipMode,
      open: isFloating(),
      capability: capability.mode,
      capabilityReason: capability.reason,
      lastError,
      workerPainted,
      videoFramesSeen,
    };
  }

  function showPlaceholder(visible) {
    const placeholder = getPlaceholder();
    if (!placeholder) return;
    placeholder.hidden = !visible;
  }

  function notify() {
    if (typeof onChange === 'function') onChange();
  }

  function syncParams() {
    if (!pipWorker) return;
    const params = typeof getFrameParams === 'function' ? getFrameParams() : null;
    if (!params) return;
    pipWorker.postMessage({ type: 'params', hz: params.hz, active: params.active });
  }

  /* ── RUTA 1: Document Picture-in-Picture ── */

  function copyStylesInto(targetWindow) {
    const head = targetWindow.document.head;
    const meta = targetWindow.document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.appendChild(meta);
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      head.appendChild(node.cloneNode(true));
    });
  }

  function stopPipLoop() {
    if (pipWindow && pipRafId) pipWindow.cancelAnimationFrame(pipRafId);
    pipRafId = 0;
  }

  function startPipLoop() {
    if (!pipWindow) return;
    const step = (ts) => {
      if (!pipWindow) return;
      paintFrame(typeof ts === 'number' ? ts : pipWindow.performance.now());
      pipRafId = pipWindow.requestAnimationFrame(step);
    };
    pipRafId = pipWindow.requestAnimationFrame(step);
  }

  function restorePanelToPage() {
    const panel = getSurfaceDocument().getElementById('strobePanel');
    stopPipLoop();
    if (panel && restorePoint && restorePoint.parent) {
      restorePoint.parent.insertBefore(panel, restorePoint.next || null);
    }
    restorePoint = null;
    if (panel) delete panel.dataset.strobeFloating;
    pipWindow = null;
    pipRafId = 0;
    showPlaceholder(false);
    if (typeof resizeSurface === 'function') resizeSurface();
    notify();
  }

  async function openDocumentWindow() {
    const panel = getPanel();
    if (!panel) throw new Error('no hay panel de estrobo en el documento');
    const opened = await window.documentPictureInPicture.requestWindow({
      width: 420,
      height: 560,
    });
    if (!opened) throw new Error('el navegador no devolvió ventana');
    copyStylesInto(opened);
    opened.document.title = 'Cortex · luz estroboscópica';
    opened.document.body.classList.add('cortex-pip');

    restorePoint = { parent: panel.parentNode, next: panel.nextSibling };
    panel.dataset.strobeFloating = 'open';
    opened.document.body.appendChild(panel);

    pipWindow = opened;
    pipMode = 'document';
    showPlaceholder(true);
    if (typeof resizeSurface === 'function') resizeSurface();
    notify();

    opened.addEventListener('resize', () => {
      if (typeof resizeSurface === 'function') resizeSurface();
    });
    /* La ventana flotante se puede cerrar desde su propio botón de sistema:
       el panel tiene que volver al documento o la UI pierde el estrobo. */
    opened.addEventListener('pagehide', () => {
      if (pipMode !== 'document') return;
      pipMode = null;
      restorePanelToPage();
      if (typeof showToast === 'function') showToast('ventana flotante cerrada');
    });

    startPipLoop();
  }

  /* ── RUTA 2: PiP de vídeo con Worker + OffscreenCanvas ── */

  function ensurePipCanvas() {
    if (pipCanvas) return pipCanvas;
    const canvas = document.createElement('canvas');
    canvas.id = PIP_CANVAS_ID;
    canvas.width = PIP_CANVAS_SIZE;
    canvas.height = PIP_CANVAS_SIZE;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.classList.add('strobe-pip-canvas');
    document.body.appendChild(canvas);
    pipCanvas = canvas;
    return canvas;
  }

  function ensurePipVideo(stream) {
    if (pipVideo) {
      pipVideo.srcObject = stream;
      return pipVideo;
    }
    const video = document.createElement('video');
    video.id = PIP_VIDEO_ID;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.classList.add('strobe-pip-video');
    video.srcObject = stream;
    video.addEventListener('enterpictureinpicture', () => {
      videoFramesSeen = 0;
    });
    video.addEventListener('leavepictureinpicture', () => {
      if (pipMode !== 'video') return;
      pipMode = null;
      teardownVideoPip();
      notify();
      if (typeof showToast === 'function') showToast('ventana flotante cerrada');
    });
    document.body.appendChild(video);
    pipVideo = video;
    return video;
  }

  function ensurePipWorker() {
    if (pipWorker) return pipWorker;
    const blob = new Blob([buildStrobeWorkerSource()], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'frames') workerPainted = data.painted || 0;
    };
    pipWorker = worker;
    return worker;
  }

  async function waitForVideoFrames(video, timeoutMs = PIP_FRAME_PROBE_MS) {
    if (typeof video.requestVideoFrameCallback === 'function') {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        try {
          video.requestVideoFrameCallback(() => {
            videoFramesSeen += 1;
            finish(true);
          });
        } catch (error) {
          finish(false);
          return;
        }
        setTimeout(() => finish(false), timeoutMs);
      });
    }
    const start = video.currentTime;
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    return video.readyState >= 2 && (video.currentTime > start || video.videoWidth > 0);
  }

  function teardownVideoPip() {
    if (pipWorker) pipWorker.postMessage({ type: 'stop' });
    if (!pipVideo) return;
    pipVideo.pause();
    if (document.pictureInPictureElement === pipVideo && document.exitPictureInPicture) {
      document.exitPictureInPicture().catch(() => {});
    }
  }

  async function openVideoWindow() {
    const canvas = ensurePipCanvas();
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      throw new Error('OffscreenCanvas no disponible');
    }
    const worker = ensurePipWorker();
    const params = typeof getFrameParams === 'function' ? getFrameParams() : { hz: 10, active: false };

    if (!pipStream) {
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage(
        {
          type: 'init',
          canvas: offscreen,
          width: PIP_CANVAS_SIZE,
          height: PIP_CANVAS_SIZE,
          hz: params.hz,
          active: params.active,
          mainNow: performance.now(),
        },
        [offscreen],
      );
      pipStream = canvas.captureStream(60);
    }

    const video = ensurePipVideo(pipStream);
    try {
      await video.play();
    } catch (error) {
      /* muted + autoplay: si aun así no arranca, PiP lo intenta con lo que haya */
    }
    await video.requestPictureInPicture();
    worker.postMessage({ type: 'params', hz: params.hz, active: params.active });
    worker.postMessage({ type: 'start', intervalMs: PIP_FRAME_INTERVAL_MS });

    pipMode = 'video';
    notify();

    const alive = await waitForVideoFrames(video);
    if (!alive) {
      teardownVideoPip();
      pipMode = null;
      notify();
      throw new Error('el PiP de vídeo no entregó fotogramas');
    }
  }

  async function openFloating() {
    if (isFloating()) return { opened: true, mode: pipMode, reason: 'ya abierta' };
    lastError = null;
    const attempts = capability.mode === 'document' ? ['document', 'video'] : [capability.mode];
    for (const mode of attempts) {
      if (mode === 'none') break;
      try {
        if (mode === 'document') await openDocumentWindow();
        else await openVideoWindow();
        if (isFloating()) return { opened: true, mode, reason: null };
      } catch (error) {
        lastError = error && error.message ? error.message : String(error);
        if (pipMode !== null) {
          /* La ventana llegó a abrirse y luego falló algo: limpiar antes de seguir. */
          if (pipMode === 'document') restorePanelToPage();
          else teardownVideoPip();
          pipMode = null;
          notify();
        }
      }
    }
    return { opened: false, mode: 'none', reason: lastError || capability.reason };
  }

  function closeFloating() {
    if (!isFloating()) return false;
    if (pipMode === 'document') {
      const target = pipWindow;
      pipMode = null;
      restorePanelToPage();
      if (target && typeof target.close === 'function') target.close();
      return true;
    }
    if (pipMode === 'video') {
      pipMode = null;
      teardownVideoPip();
      notify();
      return true;
    }
    return false;
  }

  return {
    capability,
    closeFloating,
    getFloatingInfo,
    getSurfaceDocument,
    isFloating,
    openFloating,
    syncParams,
  };
}
