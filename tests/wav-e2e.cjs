const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function parseWav(filePath) {
  const b = fs.readFileSync(filePath);
  if (b.length < 44) throw new Error(`WAV demasiado pequeño: ${b.length} bytes`);
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw new Error('falta RIFF');
  if (b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('falta WAVE');

  let offset = 12;
  let fmt = null;
  let data = null;
  while (offset + 8 <= b.length) {
    const id = b.toString('ascii', offset, offset + 4);
    const size = b.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === 'fmt ') fmt = {
      audioFormat: b.readUInt16LE(start),
      channels: b.readUInt16LE(start + 2),
      sampleRate: b.readUInt32LE(start + 4),
      byteRate: b.readUInt32LE(start + 8),
      blockAlign: b.readUInt16LE(start + 12),
      bitsPerSample: b.readUInt16LE(start + 14),
    };
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
  if (data.offset + data.size > b.length) throw new Error('data excede el archivo');
  if (data.size % fmt.blockAlign !== 0) throw new Error('data no alinea con frames');

  const frames = data.size / fmt.blockAlign;
  const sums = Array(fmt.channels).fill(0);
  const peaks = Array(fmt.channels).fill(0);
  const clipped = Array(fmt.channels).fill(0);
  let nonFinite = 0;
  const sampleCount = frames * fmt.channels;
  for (let frame = 0; frame < frames; frame++) {
    for (let ch = 0; ch < fmt.channels; ch++) {
      const raw = b.readInt16LE(data.offset + frame * fmt.blockAlign + ch * 2);
      const sample = raw / 32768;
      if (!Number.isFinite(sample)) nonFinite++;
      const abs = Math.abs(sample);
      sums[ch] += sample * sample;
      peaks[ch] = Math.max(peaks[ch], abs);
      if (raw === 32767 || raw === -32768) clipped[ch]++;
    }
  }
  const rms = sums.map(v => Math.sqrt(v / frames));
  const clipRate = clipped.map(v => v / frames);
  return {
    bytes: b.length,
    riffSize: b.readUInt32LE(4),
    ...fmt,
    dataBytes: data.size,
    frames,
    durationSeconds: frames / fmt.sampleRate,
    sampleCount,
    rms,
    peaks,
    clipRate,
    nonFinite,
  };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/cortex.html', { waitUntil: 'networkidle' });

  // Known configuration: a pure carrier plus binaural separation.
  await page.evaluate(() => {
    const c = window.__CORTEX__;
    Object.assign(c.state, { brainwave: 10, carrier: 200, binaural: 40, stereo: 0, fmod: 0, amod: 0, noise: 0, mix: 80 });
    for (const [id, value] of [['sliderBrainwave', 10], ['sliderCarrier', 200], ['sliderBinaural', 40]]) {
      const el = document.getElementById(id);
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#btnWav');
  const download = await downloadPromise;
  const out = path.join('/tmp', download.suggestedFilename());
  await download.saveAs(out);
  const parsed = parseWav(out);

  const failures = [];
  if (parsed.channels !== 2) failures.push(`channels=${parsed.channels}`);
  if (parsed.sampleRate !== 44100) failures.push(`sampleRate=${parsed.sampleRate}`);
  if (parsed.durationSeconds < 59.9 || parsed.durationSeconds > 60.1) failures.push(`duration=${parsed.durationSeconds}`);
  if (parsed.nonFinite !== 0) failures.push(`nonFinite=${parsed.nonFinite}`);
  if (parsed.rms.some(v => v <= 0.0001)) failures.push(`silent RMS=${parsed.rms.join(',')}`);
  if (parsed.peaks.some(v => v > 1.00001)) failures.push(`out-of-range peaks=${parsed.peaks.join(',')}`);
  if (parsed.clipRate.some(v => v > 0.01)) failures.push(`clipping=${parsed.clipRate.join(',')}`);
  if (errors.length) failures.push(`pageErrors=${errors.join(' | ')}`);

  console.log(JSON.stringify({ file: out, parsed, failures }, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
