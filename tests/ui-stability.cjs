/* Estabilidad de la UI ante interacción rápida: ancho de readout, dirty check,
   coalescing por frame, información de banda y animación independiente del
   framerate.
   Spec: openspec/changes/cortex-timing-and-ui-stability/specs/ui-stability/spec.md */
const path = require('path');
const fs = require('fs');
const { chromium, firefox, webkit } = require('playwright');

const engineName = process.env.ENGINE || 'chromium';
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`Unknown ENGINE: ${engineName}`);
const URL = `http://127.0.0.1:${process.env.PORT || 4173}/cortex.html`;

// El runner escribe en artifacts/: se asegura de que exista en CI y en local.
fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });

const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  // En un runner headless no hay dispositivo de salida de audio: Firefox deja el
  // AudioContext suspendido y el reloj no avanza, así que la línea de tiempo no
  // se puede medir. Se autoriza el autoplay para que el reloj quede disponible.
  // En Chromium el equivalente es --autoplay-policy.
  const launchOptions = { headless: true };
  if (engineName === 'firefox') {
    launchOptions.firefoxUserPrefs = {
      'media.autoplay.default': 0,
      'media.autoplay.blocking_policy': 0,
      'media.navigator.permission.disabled': true,
    };
  }
  if (engineName === 'chromium') {
    launchOptions.args = ['--autoplay-policy=no-user-gesture-required'];
  }

  let browser;
  try {
    browser = await browserType.launch(launchOptions);
  } catch (e) {
    console.log(`BLOCKED  ${engineName} no disponible: ${e.message.split('\n')[0]}`);
    fs.writeFileSync(path.join(process.cwd(), 'artifacts', `ui-stability-${engineName}.json`),
      JSON.stringify({ engine: engineName, status: 'BLOCKED', reason: e.message.split('\n')[0] }, null, 2));
    process.exit(0);
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
  // Click real, no engine.start() desde evaluate: Firefox exige un gesto del
  // usuario para que el AudioContext pase a 'running'.
  await page.click('#btnPlay');
  // ctx.resume() es asíncrono: leer el estado justo después del click da una
  // carrera. Se espera a que el contexto quede 'running'.
  const clockReady = await page.waitForFunction(
    () => { const c = window.__CORTEX__.engine.ctx; return Boolean(c) && c.state === 'running'; },
    null, { timeout: 8000 }
  ).then(() => true).catch(() => false);
  if (!clockReady) {
    const st = await page.evaluate(() => (window.__CORTEX__.engine.ctx || {}).state || 'none');
    console.log(`BLOCKED  reloj de audio no disponible en este motor (ctx=${st})`);
    await browser.close();
    process.exit(0);
  }

  // 1. Ancho de readout estable y cifras tabulares
  const layout = await page.evaluate(async () => {
    const sl = document.getElementById('sliderAmod');
    const read = () => document.getElementById('valAmod').getBoundingClientRect().width;
    const head = () => document.querySelector('.mod-head').getBoundingClientRect().width;
    const nameX = () => document.querySelector('.mod-name').getBoundingClientRect().x;
    const widths = [], heads = [], xs = [];
    for (const v of [0, 5, 37, 50, 99, 100]) {
      sl.value = String(v);
      sl.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(r));
      widths.push(read()); heads.push(head()); xs.push(nameX());
    }
    const val = document.getElementById('valAmod');
    const ctrl = document.getElementById('valCarrier');
    return {
      widths, heads, xs, text: val.textContent,
      tabular: getComputedStyle(val).fontVariantNumeric,
      modMinWidth: getComputedStyle(val).minWidth,
      ctrlMinWidth: getComputedStyle(ctrl).minWidth,
      ctrlTabular: getComputedStyle(ctrl).fontVariantNumeric,
      beatTabular: getComputedStyle(document.getElementById('statusBeatValue')).fontVariantNumeric
    };
  });
  const spread = a => Math.max(...a) - Math.min(...a);
  check(spread(layout.widths) === 0, 'el ancho del readout no varía (0%→100%)', `spread=${spread(layout.widths)}px`);
  check(spread(layout.heads) === 0, 'el ancho del .mod-head no varía', `spread=${spread(layout.heads)}px`);
  check(spread(layout.xs) === 0, 'el nombre del modulador no se mueve', `spread=${spread(layout.xs)}px`);
  check(layout.tabular.includes('tabular-nums'), '.mod-val con cifras tabulares', layout.tabular);
  check(layout.ctrlTabular.includes('tabular-nums'), '.ctrl-val con cifras tabulares', layout.ctrlTabular);
  check(layout.beatTabular.includes('tabular-nums'), 'el beat de la barra de estado con cifras tabulares', layout.beatTabular);
  check(layout.modMinWidth !== '0px' && layout.ctrlMinWidth !== '0px', 'los readouts reservan ancho',
    `mod=${layout.modMinWidth} ctrl=${layout.ctrlMinWidth}`);
  check(layout.text === '100%', 'el readout refleja el valor final', layout.text);

  // 2. Dirty check: sin escritura si el valor no cambia
  const dirty = await page.evaluate(async () => {
    const el = document.getElementById('valAmod');
    let writes = 0;
    const obs = new MutationObserver(m => { writes += m.length; });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
    window.__CORTEX__.setText('valAmod', el.textContent);
    await new Promise(r => requestAnimationFrame(r));
    const same = writes;
    window.__CORTEX__.setText('valAmod', '42%');
    await new Promise(r => requestAnimationFrame(r));
    obs.disconnect();
    return { same, changed: writes, text: el.textContent };
  });
  check(dirty.same === 0, 'setText no escribe si el valor no cambió', `writes=${dirty.same}`);
  check(dirty.changed === 1, 'setText escribe si el valor cambió', `writes=${dirty.changed}`);

  // 3. Coalescing: una pasada de UI por frame
  const coalesce = await page.evaluate(async () => {
    const C = window.__CORTEX__;
    const before = C.getUiPasses();
    const sl = document.getElementById('sliderFmod');
    for (let i = 0; i < 40; i++) {
      sl.value = String(i);
      sl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const sameFrame = C.getUiPasses() - before;
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    return { sameFrame, afterFrame: C.getUiPasses() - before, state: C.state.fmod, text: document.getElementById('valFmod').textContent };
  });
  check(coalesce.sameFrame === 0, '40 eventos input → 0 pasadas en el mismo frame', `pasadas=${coalesce.sameFrame}`);
  check(coalesce.afterFrame === 1, 'los 40 eventos producen una sola pasada', `pasadas=${coalesce.afterFrame}`);
  check(coalesce.state === 39, 'el estado y el motor reflejan el valor de inmediato', `fmod=${coalesce.state}`);
  check(coalesce.text === '39%', 'la UI converge al valor final', coalesce.text);

  // 4. Información de banda solo al cruzar de banda
  const band = await page.evaluate(async () => {
    const C = window.__CORTEX__;
    const sl = document.getElementById('sliderBrainwave');
    const desc = document.getElementById('bandDesc');
    sl.value = '10'; sl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => requestAnimationFrame(r));
    const alpha = { band: C.state.band, regions: document.querySelectorAll('.region.active').length };
    let writes = 0;
    const obs = new MutationObserver(m => { writes += m.length; });
    obs.observe(desc, { childList: true, characterData: true, subtree: true });
    for (const v of [10.5, 11, 11.5, 11.9]) {
      sl.value = String(v); sl.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => requestAnimationFrame(r));
    }
    obs.disconnect();
    sl.value = '20'; sl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => requestAnimationFrame(r));
    const beta = { band: C.state.band, name: document.getElementById('bandName').textContent, regions: document.querySelectorAll('.region.active').length };
    sl.value = '40'; sl.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => requestAnimationFrame(r));
    return { alpha, writesWithinBand: writes, beta, gamma: { band: C.state.band, regions: document.querySelectorAll('.region.active').length } };
  });
  check(band.writesWithinBand === 0, 'sin escrituras de bandDesc dentro de la misma banda', `writes=${band.writesWithinBand}`);
  check(band.alpha.band === 'alpha' && band.beta.band === 'beta' && band.gamma.band === 'gamma',
    'state.band sigue a la frecuencia', JSON.stringify([band.alpha.band, band.beta.band, band.gamma.band]));
  check(band.beta.name === 'Beta', 'bandName se actualiza al cruzar', band.beta.name);
  check(band.beta.regions > 0 && band.gamma.regions > 0, 'las regiones se resaltan al cruzar',
    `beta=${band.beta.regions} gamma=${band.gamma.regions}`);

  // 5. Pulso por variable CSS, sin estilos inline por nodo
  const pulse = await page.evaluate(async () => {
    const C = window.__CORTEX__;
    C.state.playing = true;
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => requestAnimationFrame(r));
    const svg = document.querySelector('.brain-svg');
    const active = [...document.querySelectorAll('.region.active')];
    return {
      varValue: svg.style.getPropertyValue('--brain-pulse'),
      inlineStyles: active.filter(el => el.getAttribute('style')).length,
      activeCount: active.length,
      computed: active.length ? getComputedStyle(active[0]).opacity : null
    };
  });
  check(pulse.varValue !== '' && Number(pulse.varValue) > 0, 'se escribe --brain-pulse', pulse.varValue);
  check(pulse.inlineStyles === 0, 'ninguna región con estilo inline', `inline=${pulse.inlineStyles}`);
  check(Number(pulse.computed) > 0.5 && Number(pulse.computed) <= 1, 'la opacidad efectiva viene de la variable',
    `opacity=${pulse.computed}`);

  // 6. Animación independiente del framerate
  const wave = await page.evaluate(async () => {
    const C = window.__CORTEX__;
    C.state.playing = false;
    await new Promise(r => requestAnimationFrame(r));
    const reset = C.getWavePhaseState().elapsedMs;
    C.state.playing = true;
    C.drawWaveFrame(1000);
    C.drawWaveFrame(1000 + 1000 / 120);
    const one120 = C.getWavePhaseState().elapsedMs;
    C.drawWaveFrame(1000 + 2000 / 120);
    const two120 = C.getWavePhaseState().elapsedMs;
    C.drawWaveFrame(1000 + 1000 / 60);
    const one60 = C.getWavePhaseState().elapsedMs;
    C.drawWaveFrame(2000);
    const jump = C.getWavePhaseState().elapsedMs;
    return { reset, one120, two120, one60, jump };
  });
  check(wave.reset === 0, 'la fase se reinicia al parar', `elapsed=${wave.reset}`);
  check(Math.abs(wave.one120 - 8.333) < 0.5, 'un frame de 120 Hz suma 8.33 ms', `elapsed=${wave.one120.toFixed(3)}`);
  check(Math.abs(wave.two120 - 16.667) < 0.5, 'dos frames de 120 Hz suman 16.67 ms', `elapsed=${wave.two120.toFixed(3)}`);
  check(Math.abs(wave.one60 - 16.667) < 0.5, 'un frame de 60 Hz suma 16.67 ms', `elapsed=${wave.one60.toFixed(3)}`);
  check(Math.abs(wave.two120 - wave.one60) < 0.01, 'la misma duración real da la misma fase con distinto framerate',
    `120Hzx2=${wave.two120.toFixed(3)} 60Hzx1=${wave.one60.toFixed(3)}`);
  check(wave.jump > 900, 'elapsed crece con el tiempo real, no con los frames', `elapsed=${wave.jump.toFixed(1)}`);

  check(errors.length === 0, 'página sin errores', errors.join(' | '));
  await page.close();
  await browser.close();

  const failures = results.filter(r => !r.pass).map(r => r.name);
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', `ui-stability-${engineName}.json`),
    JSON.stringify({ engine: engineName, total: results.length, failed: failures.length, results }, null, 2));

  console.log(`\n${results.length - failures.length}/${results.length} verificaciones OK`);
  if (failures.length) {
    console.log('fallos:\n' + failures.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(2); });
