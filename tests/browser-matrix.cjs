const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchOptionsForEngine,
  parseWav,
  runPlaybackLifecycle,
} = require('./cortex-browser-helpers.cjs');

async function runEngine(name, browserType) {
  let browser;
  try {
    browser = await browserType.launch(launchOptionsForEngine(name));
  } catch (error) {
    return { engine: name, status: 'BLOCKED', reason: error.message.split('\n')[0] };
  }

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const capture = attachPageErrorCapture(page);
  try {
    await gotoCortexApp(page);
    const dom = await page.evaluate(() => ({
      hasTestApi: Boolean(window.__CORTEX__),
      hasPlay: Boolean(document.querySelector('#btnPlay')),
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      radarDataUrl: document.querySelector('#radarCanvas').toDataURL('image/png').length > 100,
    }));

    const lifecycle = await runPlaybackLifecycle(page, { settleMs: 80 });

    const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
    await page.click('#btnWav');
    const download = await downloadPromise;
    const wavPath = path.join('/tmp', `${name}-${download.suggestedFilename()}`);
    await download.saveAs(wavPath);
    let wav = null;
    let wavError = null;
    try {
      wav = parseWav(wavPath);
    } catch (error) {
      wavError = error.message;
    }
    const downloadOk = Boolean(wav);

    const failures = [];
    if (!dom.hasTestApi || !dom.hasPlay || !dom.noHorizontalOverflow || !dom.radarDataUrl) failures.push(`DOM/Canvas: ${JSON.stringify(dom)}`);
    if (lifecycle.first !== 'reproduciendo' || lifecycle.duringStop !== 'deteniendo suave' || lifecycle.second !== 'detenido' || lifecycle.third !== 'reproduciendo') {
      failures.push(`lifecycle: ${lifecycle.first}/${lifecycle.duringStop}/${lifecycle.second}/${lifecycle.third}`);
    }
    if (!downloadOk) failures.push(`WAV parse invalid: ${wavError}`);
    if (wav && (wav.channels !== 2 || wav.sampleRate !== 44100 || wav.durationSeconds < 59.9 || wav.durationSeconds > 60.1)) failures.push(`WAV metadata: ${JSON.stringify(wav)}`);
    if (wav && (wav.nonFinite !== 0 || wav.rms.some(value => value <= 0.0001) || wav.peaks.some(value => value > 1.00001) || wav.clipRate.some(value => value > 0.01))) failures.push(`WAV samples: ${JSON.stringify(wav)}`);
    if (capture.combined().length) failures.push(`errors=${capture.combined().join(' | ')}`);

    return {
      engine: name,
      status: failures.length ? 'FAIL' : 'PASS',
      dom,
      lifecycle: {
        first: lifecycle.first,
        duringStop: lifecycle.duringStop,
        second: lifecycle.second,
        third: lifecycle.third,
      },
      downloadOk,
      wav,
      errors: capture.combined(),
      failures,
    };
  } catch (error) {
    return { engine: name, status: 'FAIL', reason: error.message, errors: capture.combined() };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  for (const [name, type] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
    results.push(await runEngine(name, type));
  }
  const outDir = ensureArtifactsDir();
  fs.writeFileSync(path.join(outDir, 'browser-matrix.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.some(result => result.status === 'FAIL') ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
