const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
  parseWav,
  startAudioClock,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(outDir, 'noise-carrier.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage();
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page);
  await startAudioClock(page);

  const inspect = () => page.evaluate(() => {
    const n = window.__CORTEX__.audio.engine.nodes;
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
    c.session.state.noise = 0;
    c.session.state.fmod = 0;
    c.audio.engine.updateModLevels();
  });
  await page.waitForTimeout(120);
  const zero = await inspect();

  await page.evaluate(() => {
    const c = window.__CORTEX__;
    c.session.state.carrier = 400;
    c.session.state.noise = 100;
    c.session.state.fmod = 50;
    c.audio.engine.updateCarrier(400);
    c.audio.engine.updateModLevels();
  });
  await page.waitForTimeout(120);
  const full = await inspect();

  const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#btnWav');
  const download = await downloadPromise;
  const wavPath = path.join('/tmp', `cortex-noise-${download.suggestedFilename()}`);
  await download.saveAs(wavPath);
  const wav = parseWav(wavPath);

  const failures = [];
  if (zero.filterType !== 'bandpass' || zero.q !== 2) failures.push(`filter contract: ${JSON.stringify(zero)}`);
  if (!zero.hasStereoNoiseSources) failures.push('missing independent L/R noise sources');
  if (zero.carrierGain < 0.24 || zero.noiseGain > 0.01) failures.push(`noise=0 crossfade: ${JSON.stringify(zero)}`);
  if (full.carrierGain > 0.01 || full.noiseGain < 0.24) failures.push(`noise=100 crossfade: ${JSON.stringify(full)}`);
  if (Math.abs(full.filterFrequency - 400) > 2) failures.push(`carrier tracking: ${JSON.stringify(full)}`);
  if (full.filterDepth <= 0) failures.push(`f-mod depth missing: ${JSON.stringify(full)}`);
  if (wav.riff !== 'RIFF' || wav.wave !== 'WAVE' || wav.riffSize == null || wav.channels !== 2 || wav.sampleRate !== 44100 || wav.bitsPerSample !== 16 || wav.dataBytes <= 0 || wav.peaks.some((value) => value > 1.00001) || wav.clipRate.some((value) => value > 0.01)) failures.push(`WAV: ${JSON.stringify(wav)}`);
  if (capture.combined().length) failures.push(`pageErrors=${capture.combined().join(' | ')}`);

  const report = { zero, full, wav, failures };
  fs.writeFileSync(path.join(outDir, 'noise-carrier.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
