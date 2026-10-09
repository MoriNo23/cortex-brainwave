const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  cortexBaseUrl,
  ensureArtifactsDir,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const visualDir = ensureArtifactsDir('visual');
  const reportFile = path.join(artifactsDir, 'astro-shell-smoke-chromium.json');
  const screenshotFile = path.join(visualDir, 'astro-shell-home.png');

  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile,
    reportData: { route: '/' },
  });
  if (launch.blocked) process.exit(0);

  const browser = launch.browser;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const capture = attachPageErrorCapture(page);

  await page.goto(`${cortexBaseUrl()}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');

  const before = await page.evaluate(() => ({
    hasApp: Boolean(document.querySelector('.app')),
    hasHeader: Boolean(document.querySelector('.header')),
    hasLeftPanel: Boolean(document.querySelector('.panel-left')),
    hasVisualArea: Boolean(document.querySelector('.brain-area')),
    hasRightPanel: Boolean(document.querySelector('.panel-right')),
    hasTimelineDock: Boolean(document.getElementById('timelineDock')),
    hasStatusBar: Boolean(document.querySelector('.status-bar')),
    hasStrobePanel: Boolean(document.getElementById('strobePanel')),
    noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
    strobePresentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
    strobeActive: Boolean(window.__CORTEX__.session.state.strobe.active),
    strobeMode: window.__CORTEX__.session.state.strobe.mode,
    strobeHz: window.__CORTEX__.strobe.effectiveStrobeHz(),
  }));

  await page.click('#btnStrobePlay');
  await page.waitForTimeout(120);
  const afterPlay = await page.evaluate(() => ({
    active: Boolean(window.__CORTEX__.session.state.strobe.active),
    label: document.getElementById('strobeHzLabel')?.textContent || '',
  }));

  await page.click('#btnStrobeMini');
  await page.waitForTimeout(80);
  const afterMini = await page.evaluate(() => ({
    presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
    button: document.getElementById('btnStrobeMini')?.textContent || '',
  }));

  await page.click('#strobeModeCustom');
  await page.evaluate(() => {
    const slider = document.getElementById('sliderStrobeHz');
    slider.value = '18';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(80);
  const afterCustom = await page.evaluate(() => ({
    mode: window.__CORTEX__.session.state.strobe.mode,
    customHz: window.__CORTEX__.session.state.strobe.customHz,
    effectiveHz: window.__CORTEX__.strobe.effectiveStrobeHz(),
    sliderDisabled: document.getElementById('sliderStrobeHz')?.disabled || false,
  }));

  await page.click('#btnStrobeStop');
  await page.waitForTimeout(80);
  const afterStop = await page.evaluate(() => ({
    active: Boolean(window.__CORTEX__.session.state.strobe.active),
    presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
  }));

  await page.screenshot({ path: screenshotFile, fullPage: true });

  const failures = [];
  if (!before.hasApp || !before.hasHeader || !before.hasLeftPanel || !before.hasVisualArea || !before.hasRightPanel || !before.hasTimelineDock || !before.hasStatusBar || !before.hasStrobePanel) {
    failures.push(`missing-surfaces: ${JSON.stringify(before)}`);
  }
  if (!before.noHorizontalOverflow) failures.push('horizontal-overflow');
  if (before.strobeActive) failures.push('strobe-started-active');
  if (before.strobeMode !== 'sync') failures.push(`unexpected-initial-strobe-mode=${before.strobeMode}`);
  if (afterPlay.active !== true) failures.push(`strobe-play=${JSON.stringify(afterPlay)}`);
  if (afterMini.presentation !== 'mini') failures.push(`strobe-mini=${JSON.stringify(afterMini)}`);
  if (afterCustom.mode !== 'custom' || Math.abs(afterCustom.customHz - 18) > 0.01 || Math.abs(afterCustom.effectiveHz - 18) > 0.01 || afterCustom.sliderDisabled) {
    failures.push(`strobe-custom=${JSON.stringify(afterCustom)}`);
  }
  if (afterStop.active !== false) failures.push(`strobe-stop=${JSON.stringify(afterStop)}`);
  if (capture.combined().length) failures.push(`errors=${capture.combined().join(' | ')}`);

  const report = {
    route: '/',
    before,
    afterPlay,
    afterMini,
    afterCustom,
    afterStop,
    screenshotFile,
    errors: capture.combined(),
    failures,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
