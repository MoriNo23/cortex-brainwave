const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: require('path').join(artifactsDir, 'visual-smoke-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page);
  const result = await page.evaluate(() => {
    const c = window.__CORTEX__;
    const radar = document.querySelector('#radarCanvas');
    const set = (patch) => {
      Object.assign(c.session.state, {
        stereo: 0,
        fmod: 0,
        binaural: 0,
        amod: 0,
        noise: 0,
        playing: true,
        ...patch,
      });
    };

    set({});
    c.visualizers.drawRadarFrame();
    const base = radar.toDataURL();

    set({ stereo: 80 });
    c.visualizers.drawRadarFrame();
    const stereo = radar.toDataURL();

    set({ fmod: 80 });
    c.visualizers.drawRadarFrame();
    const fmod = radar.toDataURL();

    set({ binaural: 80 });
    c.visualizers.drawRadarFrame();
    const binaural = radar.toDataURL();

    set({ stereo: 80, fmod: 80, binaural: 80, amod: 80, noise: 80, playing: false });
    c.visualizers.drawRadarFrame();
    const stopped = radar.toDataURL();

    c.session.state.brainwave = 2;
    c.audio.updateBrain();
    const delta = [...document.querySelectorAll('.region.active')].map((element) => element.dataset.region);

    c.session.state.brainwave = 20;
    c.audio.updateBrain();
    const beta = [...document.querySelectorAll('.region.active')].map((element) => element.dataset.region);

    return {
      different: {
        stereo: base !== stereo,
        fmod: base !== fmod,
        binaural: base !== binaural,
        stopped: stopped !== base,
      },
      delta,
      beta,
    };
  });
  console.log(JSON.stringify({ result, errors: capture.combined() }, null, 2));
  await browser.close();
  process.exit(capture.combined().length || Object.values(result.different).some((value) => !value) ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
