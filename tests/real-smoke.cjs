const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  ensureArtifactsDir,
  gotoCortexApp,
  launchBrowserOrReport,
  runPlaybackLifecycle,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: require('path').join(artifactsDir, 'real-smoke-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage();
  const capture = attachPageErrorCapture(page);
  await gotoCortexApp(page, { waitForTestApi: false });
  const lifecycle = await runPlaybackLifecycle(page);
  console.log(JSON.stringify({
    ...lifecycle,
    errors: capture.pageErrors,
    consoleErrors: capture.consoleErrors,
  }, null, 2));
  await browser.close();
  process.exit(capture.pageErrors.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
