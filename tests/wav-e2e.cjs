const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
  parseWav,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(artifactsDir, 'wav-e2e-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage();
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page);

  // Known configuration: a pure carrier plus binaural separation.
  await page.evaluate(() => {
    const c = window.__CORTEX__;
    Object.assign(c.session.state, { brainwave: 10, carrier: 200, binaural: 40, stereo: 0, fmod: 0, amod: 0, noise: 0, mix: 80 });
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
  if (parsed.rms.some(value => value <= 0.0001)) failures.push(`silent RMS=${parsed.rms.join(',')}`);
  if (parsed.peaks.some(value => value > 1.00001)) failures.push(`out-of-range peaks=${parsed.peaks.join(',')}`);
  if (parsed.clipRate.some(value => value > 0.01)) failures.push(`clipping=${parsed.clipRate.join(',')}`);
  if (capture.combined().length) failures.push(`pageErrors=${capture.combined().join(' | ')}`);

  console.log(JSON.stringify({ file: out, parsed, failures }, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
