const fs = require('fs');
const path = require('path');

function cortexBaseUrl() {
  return process.env.BASE_URL || `http://127.0.0.1:${process.env.PORT || 4173}`;
}

function cortexAppUrl() {
  return `${cortexBaseUrl()}/cortex.html`;
}

function cortexSpecUrl() {
  return `${cortexBaseUrl()}/cortex.spec.html`;
}

function ensureArtifactsDir(...parts) {
  const dir = path.join(process.cwd(), 'artifacts', ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function launchOptionsForEngine(engineName) {
  const options = { headless: true };
  if (engineName === 'chromium') {
    options.args = ['--autoplay-policy=no-user-gesture-required'];
  }
  return options;
}

async function launchBrowserOrReport({
  browserType,
  engineName,
  launchOptions = { headless: true },
  reportFile = null,
  reportData = {},
}) {
  try {
    return { browser: await browserType.launch(launchOptions), blocked: false, reason: null };
  } catch (error) {
    const reason = error.message.split('\n')[0];
    console.log(`BLOCKED  ${engineName} no disponible: ${reason}`);
    if (reportFile) {
      fs.mkdirSync(path.dirname(reportFile), { recursive: true });
      fs.writeFileSync(reportFile, JSON.stringify({
        engine: engineName,
        status: 'BLOCKED',
        reason,
        ...reportData,
      }, null, 2));
    }
    return { browser: null, blocked: true, reason };
  }
}

function attachPageErrorCapture(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return {
    pageErrors,
    consoleErrors,
    combined() {
      return [
        ...pageErrors.map(message => `pageerror: ${message}`),
        ...consoleErrors.map(message => `console: ${message}`),
      ];
    },
  };
}

async function gotoCortexApp(page, { waitForTestApi = true } = {}) {
  await page.goto(cortexAppUrl(), { waitUntil: 'networkidle' });
  if (waitForTestApi) {
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
  }
}

async function gotoCortexSpec(page, { readyText = 'app lista', timeout = 15000 } = {}) {
  await page.goto(cortexSpecUrl(), { waitUntil: 'networkidle' });
  await page.waitForFunction(
    expected => document.querySelector('#status')?.textContent.includes(expected),
    readyText,
    { timeout }
  );
}

async function waitForAudioClock(page, { timeout = 8000 } = {}) {
  const ready = await page.waitForFunction(
    () => {
      const ctx = window.__CORTEX__?.audio?.engine?.ctx;
      return Boolean(ctx) && ctx.state === 'running';
    },
    null,
    { timeout }
  ).then(() => true).catch(() => false);

  if (ready) return { ready: true, state: 'running' };
  const state = await page.evaluate(() => (window.__CORTEX__?.audio?.engine?.ctx || {}).state || 'none');
  return { ready: false, state };
}

async function startAudioClock(page, { timeout = 8000 } = {}) {
  await page.click('#btnPlay');
  return waitForAudioClock(page, { timeout });
}

async function runPlaybackLifecycle(page, {
  settleMs = 100,
  stopTimeout = 5000,
  playSelector = '#btnPlay',
  statusSelector = '#statusText',
} = {}) {
  const status = page.locator(statusSelector);
  const initial = await status.innerText();
  await page.click(playSelector);
  await page.waitForTimeout(settleMs);
  const first = await status.innerText();
  await page.click(playSelector);
  const duringStop = await status.innerText();
  await page.waitForFunction(
    selector => document.querySelector(selector)?.textContent === 'detenido',
    statusSelector,
    { timeout: stopTimeout }
  );
  const second = await status.innerText();
  await page.click(playSelector);
  await page.waitForTimeout(settleMs);
  const third = await status.innerText();
  return { initial, first, duringStop, second, third };
}

function parseWav(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 44) throw new Error(`WAV demasiado pequeño: ${buffer.length} bytes`);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('falta RIFF');
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('falta WAVE');

  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buffer.readUInt16LE(start),
        channels: buffer.readUInt16LE(start + 2),
        sampleRate: buffer.readUInt32LE(start + 4),
        byteRate: buffer.readUInt32LE(start + 8),
        blockAlign: buffer.readUInt16LE(start + 12),
        bitsPerSample: buffer.readUInt16LE(start + 14),
      };
    }
    if (id === 'data') data = { offset: start, size };
    offset = start + size + (size % 2);
  }

  if (!fmt) throw new Error('falta chunk fmt ');
  if (!data) throw new Error('falta chunk data');
  if (fmt.audioFormat !== 1) throw new Error(`formato no PCM: ${fmt.audioFormat}`);
  if (fmt.bitsPerSample !== 16) throw new Error(`bits inesperados: ${fmt.bitsPerSample}`);
  if (fmt.channels < 1 || fmt.channels > 2) throw new Error(`canales inesperados: ${fmt.channels}`);
  if (fmt.blockAlign !== fmt.channels * 2) throw new Error('blockAlign incoherente');
  if (fmt.byteRate !== fmt.sampleRate * fmt.blockAlign) throw new Error('byteRate incoherente');
  if (data.offset + data.size > buffer.length) throw new Error('data excede el archivo');
  if (data.size % fmt.blockAlign !== 0) throw new Error('data no alinea con frames');

  const frames = data.size / fmt.blockAlign;
  const sums = Array(fmt.channels).fill(0);
  const peaks = Array(fmt.channels).fill(0);
  const clipped = Array(fmt.channels).fill(0);
  let nonFinite = 0;
  const sampleCount = frames * fmt.channels;

  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < fmt.channels; ch++) {
      const raw = buffer.readInt16LE(data.offset + frame * fmt.blockAlign + ch * 2);
      const sample = raw / 32768;
      if (!Number.isFinite(sample)) nonFinite++;
      const abs = Math.abs(sample);
      sums[ch] += sample * sample;
      peaks[ch] = Math.max(peaks[ch], abs);
      if (raw === 32767 || raw === -32768) clipped[ch]++;
    }
  }

  return {
    bytes: buffer.length,
    riff: buffer.toString('ascii', 0, 4),
    wave: buffer.toString('ascii', 8, 12),
    riffSize: buffer.readUInt32LE(4),
    ...fmt,
    dataBytes: data.size,
    frames,
    durationSeconds: frames / fmt.sampleRate,
    sampleCount,
    rms: sums.map(value => Math.sqrt(value / frames)),
    peaks,
    clipRate: clipped.map(value => value / frames),
    nonFinite,
  };
}

module.exports = {
  attachPageErrorCapture,
  cortexAppUrl,
  cortexBaseUrl,
  cortexSpecUrl,
  ensureArtifactsDir,
  gotoCortexApp,
  gotoCortexSpec,
  launchBrowserOrReport,
  launchOptionsForEngine,
  parseWav,
  runPlaybackLifecycle,
  startAudioClock,
  waitForAudioClock,
};
