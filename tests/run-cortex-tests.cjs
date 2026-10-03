const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexSpec,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(artifactsDir, 'run-cortex-tests-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const capture = attachPageErrorCapture(page);
  await gotoCortexSpec(page);
  await page.click('#btnRun');
  await page.waitForSelector('.summary', { timeout: 30000 });
  const summary = await page.locator('.summary').innerText();
  const fails = await page.locator('.test.fail').allInnerTexts();
  const passCount = await page.locator('.test.pass').count();
  const failCount = await page.locator('.test.fail').count();
  console.log(JSON.stringify({
    summary,
    passCount,
    failCount,
    fails,
    errors: capture.combined(),
  }, null, 2));
  const outDir = ensureArtifactsDir('visual');
  await page.screenshot({ path: path.join(outDir, 'cortex-test-report.png'), fullPage: true });
  await browser.close();
  process.exit(failCount ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
