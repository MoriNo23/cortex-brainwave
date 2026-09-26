const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseWavHeader(filePath) {
  const data = fs.readFileSync(filePath);
  const channels = data.readUInt16LE(22);
  const sampleRate = data.readUInt32LE(24);
  const bitsPerSample = data.readUInt16LE(34);
  let offset = 12;
  let dataOffset = -1;
  let dataBytes = 0;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    if (id === 'data') { dataOffset = offset + 8; dataBytes = size; break; }
    offset += 8 + size + (size % 2);
  }
  let peak = 0;
  let clipped = 0;
  let sampleCount = 0;
  if (dataOffset >= 0) {
    for (let i = dataOffset; i + 1 < dataOffset + dataBytes; i += 2) {
      const raw = data.readInt16LE(i);
      const value = Math.abs(raw / 32768);
      peak = Math.max(peak, value);
      if (raw === 32767 || raw === -32768) clipped++;
      sampleCount++;
    }
  }
  return {
    bytes: data.length,
    riff: data.toString('ascii', 0, 4),
    wave: data.toString('ascii', 8, 12),
    channels,
    sampleRate,
    bitsPerSample,
    dataBytes,
    peak,
    clipRate: sampleCount ? clipped / sampleCount : 1,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/cortex.html', { waitUntil: 'networkidle' });
  await page.click('#btnPlay');

  const inspect = () => page.evaluate(() => {
    const n = window.__CORTEX__.engine.nodes;
    return {
      filterType: n.noiseFilterL.type,
      q: n.noiseFilterL.Q.value,
      hasStereoNoiseSources: Boolean(n.noiseSourceL && n.noiseSourceR),
      carrierGain: n.carrierGain.gain.value,
      noiseGain: n.noiseBlendGain.gain.value,
      filterFrequency: n.noiseFilterL.frequency.value,
      filterDepth: n.noiseFilterDepth.gain.value,
    };
  });

  await page.evaluate(() => {
    const c = window.__CORTEX__;
    c.state.noise = 0;
    c.state.fmod = 0;
    c.engine.updateModLevels();
  });
  await page.waitForTimeout(120);
  const zero = await inspect();

  await page.evaluate(() => {
    const c = window.__CORTEX__;
    c.state.carrier = 400;
    c.state.noise = 100;
    c.state.fmod = 50;
    c.engine.updateCarrier(400);
    c.engine.updateModLevels();
  });
  await page.waitForTimeout(120);
  const full = await inspect();

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#btnWav');
  const download = await downloadPromise;
  const wavPath = path.join('/tmp', `cortex-noise-${download.suggestedFilename()}`);
  await download.saveAs(wavPath);
  const wav = parseWavHeader(wavPath);

  const failures = [];
  if (zero.filterType !== 'bandpass' || zero.q !== 2) failures.push(`filter contract: ${JSON.stringify(zero)}`);
  if (!zero.hasStereoNoiseSources) failures.push('missing independent L/R noise sources');
  if (zero.carrierGain < 0.24 || zero.noiseGain > 0.01) failures.push(`noise=0 crossfade: ${JSON.stringify(zero)}`);
  if (full.carrierGain > 0.01 || full.noiseGain < 0.24) failures.push(`noise=100 crossfade: ${JSON.stringify(full)}`);
  if (Math.abs(full.filterFrequency - 400) > 2) failures.push(`carrier tracking: ${JSON.stringify(full)}`);
  if (full.filterDepth <= 0) failures.push(`f-mod depth missing: ${JSON.stringify(full)}`);
  if (wav.riff !== 'RIFF' || wav.wave !== 'WAVE' || wav.channels !== 2 || wav.sampleRate !== 44100 || wav.bitsPerSample !== 16 || wav.dataBytes <= 0 || wav.peak > 1.00001 || wav.clipRate > 0.01) failures.push(`WAV: ${JSON.stringify(wav)}`);
  if (errors.length) failures.push(`pageErrors=${errors.join(' | ')}`);

  const report = { zero, full, wav, failures };
  fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'noise-carrier.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
