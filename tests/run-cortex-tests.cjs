const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors=[];
  page.on('pageerror', e=>errors.push('pageerror: '+e.message));
  page.on('console', m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
  await page.goto('http://127.0.0.1:4173/cortex.spec.html', {waitUntil:'networkidle'});
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('app lista'), null, {timeout:15000});
  await page.click('#btnRun');
  await page.waitForSelector('.summary', {timeout:30000});
  const summary=await page.locator('.summary').innerText();
  const fails=await page.locator('.test.fail').allInnerTexts();
  const passCount=await page.locator('.test.pass').count();
  const failCount=await page.locator('.test.fail').count();
  console.log(JSON.stringify({summary, passCount, failCount, fails, errors},null,2));
  // Ruta relativa al repo: una absoluta funciona en local y rompe en CI.
  const outDir = path.join(process.cwd(), 'artifacts', 'visual');
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({path: path.join(outDir, 'cortex-test-report.png'), fullPage:true});
  await browser.close();
  process.exit(failCount?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
