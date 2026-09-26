const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 for (const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
  const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/cortex.html',{waitUntil:'networkidle'});
  const m=await page.evaluate(()=>({
    viewport:innerWidth,
    bodyScrollWidth:document.body.scrollWidth,
    docScrollWidth:document.documentElement.scrollWidth,
    mainDisplay:getComputedStyle(document.querySelector('.main')).display,
    radarWidth:document.querySelector('#radarCanvas').getBoundingClientRect().width,
    brainWidth:document.querySelector('.brain-svg').getBoundingClientRect().width,
    visible:!!document.querySelector('#btnPlay')
  }));
  results.push({name:viewport.name,...m,overflow:m.docScrollWidth>viewport.width+1,errors});
  await page.close();
 }
 console.log(JSON.stringify(results,null,2));
 await browser.close();
 process.exit(results.some(r=>r.overflow||r.errors.length)?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
