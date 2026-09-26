const fs = require('fs');
const { chromium } = require('playwright');
(async()=>{
 const original=fs.readFileSync('cortex.html','utf8');
 const marker='if (state.playing) {\n    /* perception field — stereo: horizontal band */';
 if(!original.includes(marker)) throw new Error('mutation marker not found');
 const mutated=original.replace(marker,'if (true) {\n    /* perception field — stereo: horizontal band */');
 fs.writeFileSync('/tmp/cortex-mutated.html',mutated);
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:4173/cortex.spec.html',{waitUntil:'networkidle'});
 await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('app lista'), null, {timeout:15000});
 await page.locator('#filePicker').setInputFiles('/tmp/cortex-mutated.html');
 await page.waitForTimeout(300);
 await page.click('#btnRun');
 await page.waitForSelector('.summary', {timeout:30000});
 const summary=await page.locator('.summary').innerText();
 const fails=await page.locator('.test.fail').allInnerTexts();
 console.log(JSON.stringify({summary,failCount:fails.length,fails:fails.slice(0,5)},null,2));
 await browser.close();
 // Mutation test passes when the suite catches the intentional defect.
 process.exit(fails.length>0?0:1);
})().catch(e=>{console.error(e);process.exit(2)});
