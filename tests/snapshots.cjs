const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

const outDir = ensureArtifactsDir('visual');

function decodeDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function diffPng(aPath, bPath, threshold = 10) {
  const a = readPng(aPath);
  const b = readPng(bPath);
  if (a.width !== b.width || a.height !== b.height) {
    return { differentDimensions: true, ratio: 1, pixels: a.width * a.height };
  }
  let changed = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const delta = Math.max(
      Math.abs(a.data[i] - b.data[i]),
      Math.abs(a.data[i + 1] - b.data[i + 1]),
      Math.abs(a.data[i + 2] - b.data[i + 2]),
      Math.abs(a.data[i + 3] - b.data[i + 3]),
    );
    if (delta > threshold) changed++;
  }
  const pixels = a.width * a.height;
  return { differentDimensions: false, changedPixels: changed, pixels, ratio: changed / pixels, threshold };
}

(async () => {
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(outDir, 'snapshot-report.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page);

  const radarStates = {
    base: { playing: false },
    stereo: { playing: true, stereo: 80 },
    fmod: { playing: true, fmod: 80 },
    binaural: { playing: true, binaural: 80 },
  };
  const brainStates = { delta: 2, alpha: 10, beta: 20 };
  const radarFiles = {};
  const brainFiles = {};

  for (const [name, mods] of Object.entries(radarStates)) {
    const dataUrl = await page.evaluate((modsArg) => {
      const c = window.__CORTEX__;
      Object.assign(c.session.state, { stereo: 0, fmod: 0, binaural: 0, amod: 0, noise: 0, ...modsArg });
      c.visualizers.drawRadarFrame(c.visualizers.getRadarStart() + 1000);
      return document.querySelector('#radarCanvas').toDataURL('image/png');
    }, mods);
    const file = path.join(outDir, `radar-${name}.png`);
    fs.writeFileSync(file, decodeDataUrl(dataUrl));
    radarFiles[name] = file;
  }

  for (const [name, freq] of Object.entries(brainStates)) {
    await page.evaluate((freqArg) => {
      const c = window.__CORTEX__;
      c.session.state.brainwave = freqArg;
      c.audio.updateBrain();
    }, freq);
    await page.waitForTimeout(350);
    const file = path.join(outDir, `brain-${name}.png`);
    await page.locator('.brain-svg').screenshot({ path: file });
    brainFiles[name] = file;
  }

  const comparisons = {
    radarStereo: diffPng(radarFiles.base, radarFiles.stereo),
    radarFmod: diffPng(radarFiles.base, radarFiles.fmod),
    radarBinaural: diffPng(radarFiles.base, radarFiles.binaural),
    brainDeltaAlpha: diffPng(brainFiles.delta, brainFiles.alpha),
    brainAlphaBeta: diffPng(brainFiles.alpha, brainFiles.beta),
  };
  const failures = [];
  for (const [name, result] of Object.entries(comparisons)) {
    if (result.differentDimensions || result.ratio < 0.01) failures.push(`${name}: diff ratio ${result.ratio}`);
  }
  if (capture.combined().length) failures.push(`pageErrors=${capture.combined().join(' | ')}`);

  const report = { radarFiles, brainFiles, comparisons, failures };
  fs.writeFileSync(path.join(outDir, 'snapshot-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
