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
    reportFile: require('path').join(artifactsDir, 'responsive-smoke-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const results = [];

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const capture = attachPageErrorCapture(page);
    await gotoCortexApp(page, { waitForTestApi: false });
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      mainDisplay: getComputedStyle(document.querySelector('.main')).display,
      radarWidth: document.querySelector('#radarCanvas').getBoundingClientRect().width,
      brainWidth: document.querySelector('.brain-svg').getBoundingClientRect().width,
      visible: Boolean(document.querySelector('#btnPlay')),
    }));
    results.push({
      name: viewport.name,
      ...metrics,
      overflow: metrics.docScrollWidth > viewport.width + 1,
      errors: capture.combined(),
    });
    await page.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  process.exit(results.some((result) => result.overflow || result.errors.length) ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
