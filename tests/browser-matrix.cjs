const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');

function parseWav(filePath) {
  const b = fs.readFileSync(filePath);
  if (b.length < 44 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('RIFF/WAVE inválido');
  let offset = 12, fmt = null, data = null;
  while (offset + 8 <= b.length) {
    const id = b.toString('ascii', offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') fmt = {
      audioFormat: b.readUInt16LE(start), channels: b.readUInt16LE(start + 2),
      sampleRate: b.readUInt32LE(start + 4), byteRate: b.readUInt32LE(start + 8),
      blockAlign: b.readUInt16LE(start + 12), bitsPerSample: b.readUInt16LE(start + 14),
    };
    if (id === 'data') data = { offset: start, size };
    offset = start + size + (size % 2);
  }
  if (!fmt || !data || fmt.audioFormat !== 1 || fmt.bitsPerSample !== 16) throw new Error('PCM16 chunks inválidos');
  if (data.offset + data.size > b.length || data.size % fmt.blockAlign !== 0) throw new Error('data chunk inválido');
  const frames = data.size / fmt.blockAlign;
  const sums = Array(fmt.channels).fill(0), peaks = Array(fmt.channels).fill(0), clipped = Array(fmt.channels).fill(0);
  let nonFinite = 0;
  for (let frame = 0; frame < frames; frame++) for (let ch = 0; ch < fmt.channels; ch++) {
    const raw = b.readInt16LE(data.offset + frame * fmt.blockAlign + ch * 2);
    const sample = raw / 32768;
    if (!Number.isFinite(sample)) nonFinite++;
    const abs = Math.abs(sample);
    sums[ch] += sample * sample;
    peaks[ch] = Math.max(peaks[ch], abs);
    if (raw === 32767 || raw === -32768) clipped[ch]++;
  }
  return {
    bytes: b.length, ...fmt, dataBytes: data.size, frames,
    durationSeconds: frames / fmt.sampleRate,
    rms: sums.map(v => Math.sqrt(v / frames)),
    peaks, clipRate: clipped.map(v => v / frames), nonFinite,
  };
}

async function runEngine(name, browserType) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
  } catch (error) {
    return { engine: name, status: 'BLOCKED', reason: error.message.split('\n')[0] };
  }

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`console: ${msg.text()}`); });
  try {
    await page.goto('http://127.0.0.1:4173/cortex.html', { waitUntil: 'networkidle' });
    const dom = await page.evaluate(() => ({
      hasTestApi: Boolean(window.__CORTEX__),
      hasPlay: Boolean(document.querySelector('#btnPlay')),
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      radarDataUrl: document.querySelector('#radarCanvas').toDataURL('image/png').length > 100,
    }));

    await page.click('#btnPlay');
    await page.waitForTimeout(80);
    const first = await page.locator('#statusText').innerText();
    await page.click('#btnPlay');
    const duringStop = await page.locator('#statusText').innerText();
    await page.waitForFunction(() => document.getElementById('statusText').textContent === 'detenido', null, { timeout: 5000 });
    const second = await page.locator('#statusText').innerText();
    await page.click('#btnPlay');
    await page.waitForTimeout(80);
    const third = await page.locator('#statusText').innerText();

    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.click('#btnWav');
    const download = await downloadPromise;
    const wavPath = path.join('/tmp', `${name}-${download.suggestedFilename()}`);
    await download.saveAs(wavPath);
    let wav = null;
    let wavError = null;
    try { wav = parseWav(wavPath); } catch (error) { wavError = error.message; }
    const downloadOk = Boolean(wav);

    const failures = [];
    if (!dom.hasTestApi || !dom.hasPlay || !dom.noHorizontalOverflow || !dom.radarDataUrl) failures.push(`DOM/Canvas: ${JSON.stringify(dom)}`);
    if (first !== 'reproduciendo' || duringStop !== 'deteniendo suave' || second !== 'detenido' || third !== 'reproduciendo') failures.push(`lifecycle: ${first}/${duringStop}/${second}/${third}`);
    if (!downloadOk) failures.push(`WAV parse invalid: ${wavError}`);
    if (wav && (wav.channels !== 2 || wav.sampleRate !== 44100 || wav.durationSeconds < 59.9 || wav.durationSeconds > 60.1)) failures.push(`WAV metadata: ${JSON.stringify(wav)}`);
    if (wav && (wav.nonFinite !== 0 || wav.rms.some(v => v <= 0.0001) || wav.peaks.some(v => v > 1.00001) || wav.clipRate.some(v => v > 0.01))) failures.push(`WAV samples: ${JSON.stringify(wav)}`);
    if (errors.length) failures.push(`errors=${errors.join(' | ')}`);
    return { engine: name, status: failures.length ? 'FAIL' : 'PASS', dom, lifecycle: { first, duringStop, second, third }, downloadOk, wav, errors, failures };
  } catch (error) {
    return { engine: name, status: 'FAIL', reason: error.message, errors };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    results.push(await runEngine(name, type));
  }
  fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'browser-matrix.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
