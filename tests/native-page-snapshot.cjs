const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/cortex.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const output = path.join(process.cwd(), 'artifacts', 'visual', 'native-page-desktop.png');
  await page.screenshot({ path: output, fullPage: false });
  const report = { output, viewport: { width: 1440, height: 900 }, errors };
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', 'visual', 'native-page-desktop.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
