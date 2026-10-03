const fs = require('fs');
const { chromium } = require('playwright');
const path = require('path');
const {
  ensureArtifactsDir,
  gotoCortexSpec,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const original = fs.readFileSync('cortex.html', 'utf8');
  const marker = 'if (state.playing) {\n    /* perception field — stereo: horizontal band */';
  if (!original.includes(marker)) throw new Error('mutation marker not found');
  const mutated = original.replace(marker, 'if (true) {\n    /* perception field — stereo: horizontal band */');
  fs.writeFileSync('/tmp/cortex-mutated.html', mutated);
  const artifactsDir = ensureArtifactsDir();
  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile: path.join(artifactsDir, 'mutation-smoke-chromium.json'),
  });
  if (launch.blocked) process.exit(0);
  const browser = launch.browser;
  const page = await browser.newPage();
  await gotoCortexSpec(page);
  await page.locator('#filePicker').setInputFiles('/tmp/cortex-mutated.html');
  await page.waitForTimeout(300);
  await page.click('#btnRun');
  await page.waitForSelector('.summary', { timeout: 30000 });
  const summary = await page.locator('.summary').innerText();
  const fails = await page.locator('.test.fail').allInnerTexts();
  console.log(JSON.stringify({ summary, failCount: fails.length, fails: fails.slice(0, 5) }, null, 2));
  await browser.close();
  process.exit(fails.length > 0 ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(2); });
