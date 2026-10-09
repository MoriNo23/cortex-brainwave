const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

const outDir = ensureArtifactsDir();

(async () => {
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(outDir, 'native-page-desktop.json'),
    reportData: { viewport: { width: 1440, height: 900 } },
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page, { waitForTestApi: false });
  await page.waitForTimeout(1000);
  const output = path.join(outDir, 'native-page-desktop.png');
  await page.screenshot({ path: output, fullPage: false });
  const report = { output, viewport: { width: 1440, height: 900 }, errors: capture.combined() };
  fs.writeFileSync(path.join(outDir, 'native-page-desktop.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(capture.combined().length ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
