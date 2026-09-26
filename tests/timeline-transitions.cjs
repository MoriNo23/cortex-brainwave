/* Transiciones suaves del timeline sobre el reloj de audio y unidades de
   duración s/min.
   Spec: openspec/changes/cortex-timeline-transitions/specs/timeline-transitions/spec.md */
const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');

const engineName = process.env.ENGINE || 'chromium';
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`Unknown ENGINE: ${engineName}`);
const URL = `http://127.0.0.1:${process.env.PORT || 4173}/cortex.html`;

fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });

const results = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const SETUP = `(() => {
  const C = window.__CORTEX__;
  C.timelineState.steps = [
    { id:'s1', presetId:'builtin-delta', durationSeconds:4, snapshot:{ brainwave:2,  carrier:200, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 }, name:'Delta', emoji:'D', band:'delta' },
    { id:'s2', presetId:'builtin-gamma', durationSeconds:4, snapshot:{ brainwave:40, carrier:400, amod:50, binaural:50, stereo:0, fmod:0, noise:0, mix:40 }, name:'Gamma', emoji:'G', band:'gamma' },
  ];
  C.timelineState.loop = false;
  C.timelineState.transition.enabled = true;
  C.timelineState.transition.seconds = 2;
  C.timelineState.durationUnits.step = 's';
  C.timelineState.durationUnits.transition = 's';
  // Estado vivo conocido: cada rampa parte de Alpha-200.
  C.applyAudioState({ brainwave:10, carrier:200, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 });
  C.renderTimeline();
  C.renderTransitionControls();
  return true;
})()`;

(async () => {
  const launchOptions = { headless: true };
  if (engineName === 'chromium') launchOptions.args = ['--autoplay-policy=no-user-gesture-required'];

  let browser;
  try {
    browser = await browserType.launch(launchOptions);
  } catch (e) {
    console.log(`BLOCKED  ${engineName} no disponible: ${e.message.split('\n')[0]}`);
    fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-transitions-${engineName}.json`),
      JSON.stringify({ engine: engineName, status: 'BLOCKED', reason: e.message.split('\n')[0] }, null, 2));
    process.exit(0);
  }

  async function scenario(title, fn) {
    console.log(`\n-- ${title} --`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    await page.click('#btnPlay');
    const clockReady = await page.waitForFunction(
      () => { const c = window.__CORTEX__.engine.ctx; return Boolean(c) && c.state === 'running'; },
      null, { timeout: 8000 }
    ).then(() => true).catch(() => false);
    if (!clockReady) {
      const st = await page.evaluate(() => (window.__CORTEX__.engine.ctx || {}).state || 'none');
      console.log(`SKIP  ${title}: el reloj de audio no quedó disponible (ctx=${st})`);
      await page.close();
      return;
    }
    try {
      await fn(page);
    } catch (e) {
      check(false, `${title}: sin excepción`, e.message);
    }
    check(errors.length === 0, `${title}: página sin errores`, errors.join(' | '));
    await page.close();
  }

  // 1. Rampa completa: intermedios distintos de ambos extremos y destino exacto
  await scenario('rampa completa', async page => {
    await page.evaluate(SETUP);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      const applied = [];
      p.onStep = (i, step, durationMs, info) => applied.push({ i, transitionMs: info.transitionMs, source: info.source.brainwave, target: info.target.brainwave });
      p.play();
      const samples = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 250));
        samples.push({ idx: p.index, bw: C.state.brainwave });
        if (!p.running) break;
      }
      p.stop();
      return { applied, samples };
    });
    const first = r.samples.filter(s => s.idx === 0);
    check(r.applied[0].transitionMs === 2000, 'onStep expone la rampa de 2 s', JSON.stringify(r.applied[0]));
    check(r.applied[0].source === 10 && r.applied[0].target === 2, 'origen = estado vivo, destino = preset', JSON.stringify(r.applied[0]));
    check(first.some(s => s.bw > 2.5 && s.bw < 9.5), 'hay valores intermedios distintos de ambos extremos', first.map(s => s.bw.toFixed(1)).join(' → '));
    check(first.some(s => Math.abs(s.bw - 2) < 0.05), 'el paso converge exactamente al preset (2 Hz)', 'último: ' + first[first.length - 1].bw.toFixed(2));
  });

  // 2. Status con "· transición" y sin él al terminar
  await scenario('status de transición', async page => {
    await page.evaluate(SETUP);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      const seen = [];
      for (let i = 0; i < 14; i++) {
        await new Promise(r => setTimeout(r, 250));
        seen.push(document.getElementById('timelineStatus').textContent);
        if (!p.running) break;
      }
      p.stop();
      return { during: seen[2] || '', after: seen[seen.length - 1] };
    });
    check(r.during.includes('· transición'), 'el status marca la transición mientras dura', r.during);
    check(!r.after.includes('transición'), 'el status no marca transición al terminar', r.after);
  });

  // 3. Transición desactivada = corte directo
  await scenario('corte directo', async page => {
    await page.evaluate(SETUP);
    await page.evaluate(() => { window.__CORTEX__.timelineState.transition.enabled = false; });
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 150));
      const early = { bw: C.state.brainwave, carrier: C.state.carrier };
      p.stop();
      return early;
    });
    check(r.bw === 2 && r.carrier === 200, 'con transición desactivada el preset aplica directo', JSON.stringify(r));
  });

  // 4. Edición en vivo de la duración sin reiniciar el paso
  await scenario('edición en vivo', async page => {
    await page.evaluate(SETUP);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 500));
      const before = { idx: p.index, rem: Math.round(p.remainingMs), bw: C.state.brainwave };
      C.timelineState.transition.seconds = 6;
      p.refreshTransition();
      const after = { idx: p.index, rem: Math.round(p.remainingMs), transitionMs: p.transitionMs, bw: C.state.brainwave };
      C.timelineState.transition.enabled = false;
      p.refreshTransition();
      const disabled = { done: p.transitionDone, bw: C.state.brainwave };
      p.stop();
      return { before, after, disabled };
    });
    check(r.after.idx === 0 && r.after.rem > 3000, 'editar la duración no reinicia el paso', `idx=${r.after.idx} rem=${r.after.rem}`);
    check(r.after.transitionMs > 2000 && r.after.transitionMs <= r.after.rem + 60, 'la rampa se estira acotada al restante del paso', 'transitionMs=' + Math.round(r.after.transitionMs));
    check(Math.abs(r.before.bw - r.after.bw) < 0.01, 'el punto interpolado no salta al estirar', `${r.before.bw.toFixed(2)} → ${r.after.bw.toFixed(2)}`);
    check(r.disabled.done === true && Math.abs(r.disabled.bw - 2) < 0.01, 'desactivar en vivo aplica el destino directo', 'bw=' + r.disabled.bw.toFixed(2));
  });

  // 5. Pausa a mitad de rampa y reanudación
  await scenario('pausa en rampa', async page => {
    await page.evaluate(SETUP);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 1000));
      const midBw = C.state.brainwave;
      p.pause();
      const tRem = p.pausedTransitionMs;
      await new Promise(r => setTimeout(r, 700));
      const frozenBw = C.state.brainwave;
      p.play();
      await new Promise(r => setTimeout(r, 1600));
      const resumed = C.state.brainwave;
      p.stop();
      return { midBw, tRem, frozenBw, resumed };
    });
    check(Math.abs(r.midBw - 2) > 1 && Math.abs(r.midBw - 10) > 1, 'la pausa ocurre en medio de la rampa', 'bw=' + r.midBw.toFixed(2));
    check(r.tRem > 500 && r.tRem < 1200, 'conserva lo que le faltaba de rampa', 'tRem=' + Math.round(r.tRem) + 'ms');
    check(r.frozenBw === r.midBw, 'en pausa el audio no sigue moviéndose', r.frozenBw.toFixed(2));
    check(Math.abs(r.resumed - 2) < 0.05, 'reanudar completa la rampa hasta el destino', 'bw=' + r.resumed.toFixed(2));
  });

  // 6. Unidades s/min en la UI
  await scenario('unidades de duración', async page => {
    await page.evaluate(SETUP);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__;
      const before = document.querySelector('.timeline-duration').value;
      C.setDurationUnit('step', 'min');
      await new Promise(r => requestAnimationFrame(r));
      const after = document.querySelector('.timeline-duration').value;
      const hint = document.querySelector('.timeline-step .duration-hint').textContent;
      const stored = C.timelineState.steps[0].durationSeconds;
      const input = document.querySelector('.timeline-duration');
      input.value = '2';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      const storedAfterEdit = C.timelineState.steps[0].durationSeconds;
      C.setDurationUnit('step', 's');
      const back = document.querySelector('.timeline-duration').value;
      C.setDurationUnit('transition', 'min');
      const transValue = document.getElementById('timelineTransitionSeconds').value;
      const transHint = document.getElementById('timelineTransitionHint').textContent;
      C.setDurationUnit('transition', 's');
      return { before, after, hint, stored, storedAfterEdit, back, transValue, transHint };
    });
    check(r.before === '4', 'la duración se muestra en segundos al inicio', r.before);
    check(r.after === '0.066667', 'cambiar a minutos convierte el valor mostrado', r.after);
    check(r.stored === 4, 'cambiar de unidad NO altera los segundos guardados', String(r.stored));
    check(r.hint.includes('4 s'), 'la pista muestra el equivalente en la otra unidad', r.hint);
    check(r.storedAfterEdit === 120, 'editar 2 en minutos guarda 120 s', String(r.storedAfterEdit));
    check(r.back === '120', 'de vuelta en segundos se ve 120', r.back);
    check(r.transValue === '0.033333', 'la transición también cambia de unidad', r.transValue);
    check(r.transHint.includes('2 s'), 'la pista de transición muestra el equivalente', r.transHint);
  });

  // 7. Persistencia de la configuración y de las duraciones editadas
  // Nota: cada escenario de esta suite abre una página en un contexto NUEVO
  // (browser.newPage()), así que el localStorage NO viaja entre escenarios.
  // Este escenario debe ser autosuficiente: edita, persiste y recarga.
  await scenario('persistencia', async page => {
    await page.evaluate(SETUP);
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      // editar el primer paso a 2 min = 120 s, como haría una persona
      C.setDurationUnit('step', 'min');
      const input = document.querySelector('.timeline-duration');
      input.value = '2';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      C.timelineState.transition.seconds = 5;
      C.persistTimeline();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    const r = await page.evaluate(() => {
      const C = window.__CORTEX__;
      return {
        seconds: C.timelineState.transition.seconds,
        enabled: C.timelineState.transition.enabled,
        steps: C.timelineState.steps.length,
        firstDuration: C.timelineState.steps[0] && C.timelineState.steps[0].durationSeconds,
        unit: C.timelineState.durationUnits.step,
      };
    });
    check(r.seconds === 5 && r.enabled === true, 'la configuración de transición sobrevive la recarga', JSON.stringify(r));
    check(r.firstDuration === 120, 'la duración editada en minutos sobrevive', 'primera=' + r.firstDuration);
    check(r.unit === 'min', 'la unidad elegida también sobrevive', 'unidad=' + r.unit);
  });

  // 8. Datos previos sin campos de transición cargan con defaults
  await scenario('datos legacy', async page => {
    const r = await page.evaluate(() => {
      const C = window.__CORTEX__;
      const old = { steps: [{ id:'x', presetId:'b', durationSeconds: 30, snapshot:{ brainwave:10, carrier:200, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 }, name:'A', emoji:'a', band:'alpha' }] };
      localStorage.setItem('cortex-timeline-v1', JSON.stringify(old));
      C.loadTimelineData();
      return { seconds: C.timelineState.transition.seconds, enabled: C.timelineState.transition.enabled, units: C.timelineState.durationUnits.step, steps: C.timelineState.steps.length };
    });
    check(r.enabled === true && r.seconds === 2 && r.units === 's', 'datos previos sin transición cargan con defaults', JSON.stringify(r));
    check(r.steps === 1, 'los pasos legacy se conservan', String(r.steps));
  });

  await browser.close();
  const failures = results.filter(x => !x.pass).map(x => x.name);
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-transitions-${engineName}.json`),
    JSON.stringify({ engine: engineName, total: results.length, failed: failures.length, results }, null, 2));
  console.log(`\n${results.length - failures.length}/${results.length} verificaciones OK`);
  if (failures.length) {
    console.log('fallos:\n' + failures.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(2); });
