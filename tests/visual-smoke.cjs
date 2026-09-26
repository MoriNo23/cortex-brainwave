const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/cortex.html',{waitUntil:'networkidle'});
 const result=await page.evaluate(()=>{
   const c=window.__CORTEX__, radar=document.querySelector('#radarCanvas');
   const set=(p)=>{Object.assign(c.state,{stereo:0,fmod:0,binaural:0,amod:0,noise:0,playing:true,...p});};
   set({}); c.drawRadarFrame(); const base=radar.toDataURL();
   set({stereo:80}); c.drawRadarFrame(); const stereo=radar.toDataURL();
   set({fmod:80}); c.drawRadarFrame(); const fmod=radar.toDataURL();
   set({binaural:80}); c.drawRadarFrame(); const binaural=radar.toDataURL();
   set({stereo:80,fmod:80,binaural:80,amod:80,noise:80,playing:false}); c.drawRadarFrame(); const stopped=radar.toDataURL();
   c.state.brainwave=2; c.updateBrain(); const delta=[...document.querySelectorAll('.region.active')].map(e=>e.dataset.region);
   c.state.brainwave=20; c.updateBrain(); const beta=[...document.querySelectorAll('.region.active')].map(e=>e.dataset.region);
   return {different:{stereo:base!==stereo,fmod:base!==fmod,binaural:base!==binaural,stopped:stopped!==base},delta,beta};
 });
 console.log(JSON.stringify({result,errors},null,2));
 await browser.close();
 process.exit(errors.length||Object.values(result.different).some(v=>!v)?1:0);
})().catch(e=>{console.error(e);process.exit(2)});
