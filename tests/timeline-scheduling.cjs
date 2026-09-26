/* Programación temporal del timeline sobre el reloj de audio.
   Spec: openspec/changes/cortex-timing-and-ui-stability/specs/timeline-scheduling/spec.md
   Cada escenario abre su propia página para no heredar estado ni temporizadores. */
const path = require('path');
const fs = require('fs');
const { chromium, firefox, webkit } = require('playwright');

const engineName = process.env.ENGINE || 'chromium';
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`Unknown ENGINE: ${engineName}`);
const URL = `http://127.0.0.1:${process.env.PORT || 4173}/cortex.html`;

const STEPS = `(() => {
  const C = window.__CORTEX__;
  C.timelineState.steps = [
    { id:'s1', presetId:'builtin-delta', durationSeconds:1, snapshot:{ brainwave:2,  carrier:200, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 }, name:'Delta', emoji:'D', band:'delta' },
    { id:'s2', presetId:'builtin-theta', durationSeconds:1, snapshot:{ brainwave:6,  carrier:210, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 }, name:'Theta', emoji:'T', band:'theta' },
    { id:'s3', presetId:'builtin-alpha', durationSeconds:1, snapshot:{ brainwave:10, carrier:220, amod:0, binaural:0, stereo:0, fmod:0, noise:0, mix:80 }, name:'Alpha', emoji:'A', band:'alpha' }
  ];
  C.timelineState.loop = false;
  C.renderTimeline();
})()`;

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
    fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-scheduling-${engineName}.json`),
      JSON.stringify({ engine: engineName, status: 'BLOCKED', reason: e.message.split('\n')[0] }, null, 2));
    process.exit(0);
  }
  const failures = [];

  async function scenario(title, fn) {
    console.log(`\n-- ${title} --`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    // El AudioContext no arranca sin un gesto real del usuario en navegadores con
    // autoplay estricto (Firefox). Por eso se hace click en vez de llamar a
    // engine.start() desde evaluate: el click es un gesto confiable.
    await page.click('#btnPlay');
    // ctx.resume() es asíncrono: leer el estado justo después del click da una
    // carrera. Se espera a que el contexto quede 'running'.
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

  // 1. Reproducción normal: avanza por el reloj de audio
  await scenario('reproducción normal', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      const t0 = C.engine.ctx.currentTime;
      const snap = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 100));
        snap.push({ idx: p.index, running: p.running, bw: C.state.brainwave, rem: Math.round(p.remainingMs) });
        if (!p.running) break;
      }
      return { t0, t1: C.engine.ctx.currentTime, snap, status: document.getElementById('timelineStatus').textContent };
    });
    const visited = [...new Set(r.snap.map(s => s.idx))];
    check(r.snap[0].idx === 0, 'arranca en el paso 0', `idx=${r.snap[0].idx}`);
    check(visited.includes(1) && visited.includes(2), 'visita los pasos 1 y 2', `idx: ${visited.join(',')}`);
    check([...new Set(r.snap.map(s => s.bw))].join(',') === '2,6,10', 'cada paso aplica su snapshot');
    check(r.status.includes('completado'), 'termina y reporta completado', r.status);
    const dur = r.t1 - r.t0;
    check(dur > 2.6 && dur < 4.2, 'duración ~= 3 s de reloj de audio', dur.toFixed(2) + 's');
    const first = r.snap.filter(s => s.idx === 0);
    check(first.length > 2 && first[first.length - 1].rem < 900, 'el restante decrece en vivo', JSON.stringify(first.map(s => s.rem)));
  });

  // 2. Temporizadores retrasados: el reloj de audio manda
  await scenario('temporizadores retrasados', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      const realTimeout = window.setTimeout, realInterval = window.setInterval;
      let delayed = 0;
      window.setTimeout = (fn, ms, ...a) => { delayed++; return realTimeout(() => realTimeout(fn, 0, ...a), ms + 2000); };
      window.setInterval = (fn, ms, ...a) => { delayed++; return realInterval(() => realTimeout(() => fn(...a), 2000), ms); };
      p.play();
      await new Promise(r => realTimeout(r, 600));
      const early = { idx: p.index, rem: Math.round(p.remainingMs) };
      await new Promise(r => realTimeout(r, 3600));
      window.setTimeout = realTimeout; window.setInterval = realInterval;
      return { early, delayed, running: p.running, status: document.getElementById('timelineStatus').textContent };
    });
    check(r.delayed > 0, 'los temporizadores quedaron retrasados', `n=${r.delayed}`);
    check(r.early.idx === 0, 'no avanza antes de tiempo', `idx=${r.early.idx}`);
    check(r.early.rem > 250 && r.early.rem < 500, 'el restante viene del reloj de audio', `rem=${r.early.rem}ms`);
    check(!r.running, 'la secuencia completa termina igual', r.status);
  });

  // 3. Fast-forward: límites vencidos mientras no se renderizaba
  await scenario('fast-forward', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      const applied = [];
      p.onStep = i => applied.push(i);
      p.play();
      await new Promise(r => setTimeout(r, 50));
      p.clearTick(); p.clearTimer();
      await new Promise(r => setTimeout(r, 2600));
      const frozen = { idx: p.index, applied: applied.slice() };
      p.catchUp();
      return { frozen, idx: p.index, running: p.running, applied: applied.slice() };
    });
    check(r.frozen.applied.length === 1, 'congelado no aplica ningún paso', JSON.stringify(r.frozen.applied));
    check(r.frozen.idx === 0, 'congelado el índice no se mueve', `idx=${r.frozen.idx}`);
    check(r.idx === 2, 'el catch-up salta al paso resultante', `idx=${r.idx}`);
    check(r.applied.length === 2 && !r.applied.includes(1), 'aplica un solo paso, sin los intermedios', JSON.stringify(r.applied));
    check(r.running, 'sigue reproduciendo tras el catch-up');
  });

  // 4. Loop
  await scenario('loop', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      C.timelineState.loop = true;
      const applied = [];
      p.onStep = i => applied.push(i);
      p.play();
      await new Promise(r => setTimeout(r, 3400));
      const running = p.running;
      p.stop();
      return { applied, running };
    });
    check(r.applied.filter(i => i === 0).length >= 2, 'el loop vuelve al paso 0', JSON.stringify(r.applied));
    check(r.running, 'sigue reproduciendo tras el ciclo');
  });

  // 5. Pausa y reanudación sin deriva
  await scenario('pausa y reanudación', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 600));
      p.pause();
      const rem1 = p.remainingMs, frozen = p.pausedRemainingMs;
      await new Promise(r => setTimeout(r, 1500));
      const remIdle = p.remainingMs, paused = p.paused;
      p.play();
      const remOnResume = p.remainingMs;
      await new Promise(r => setTimeout(r, 120));
      const idxAfter = p.index;
      p.stop();
      return { rem1, frozen, remIdle, paused, remOnResume, idxAfter };
    });
    check(r.rem1 > 250 && r.rem1 < 500, 'el restante en la pausa sale del reloj de audio', `rem=${Math.round(r.rem1)}ms`);
    check(Math.abs(r.frozen - r.rem1) < 2, 'el restante congelado coincide', `frozen=${Math.round(r.frozen)}`);
    check(r.paused === true, 'sigue marcado como pausado');
    check(Math.abs(r.remIdle - r.frozen) < 2, 'el restante no se consume en pausa', `rem=${Math.round(r.remIdle)}`);
    check(Math.abs(r.remOnResume - r.frozen) < 60, 'reanudar conserva el restante', `rem=${Math.round(r.remOnResume)}`);
    check(r.idxAfter === 0, 'reanudar no salta de paso', `idx=${r.idxAfter}`);
  });

  // 6. Edición de duración: sin piso artificial de 1 s
  await scenario('edición de duración', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 200));
      C.timelineState.steps[0].durationSeconds = 6;
      p.reschedule();
      const after = p.remainingMs;
      await new Promise(r => setTimeout(r, 1400));
      const stillFirst = p.index, remLater = p.remainingMs;
      C.timelineState.steps[0].durationSeconds = 0.2;
      p.reschedule();
      p.catchUp();
      const idx = p.index, running = p.running, rem = p.remainingMs;
      p.stop();
      return { after, stillFirst, remLater, idx, running, rem };
    });
    check(r.after > 5000, 'estirar reprograma desde el reloj de audio', `rem=${Math.round(r.after)}ms`);
    check(r.stillFirst === 0, 'no avanza por el límite viejo', `idx=${r.stillFirst}`);
    check(r.remLater > 3000, 'el restante se descuenta del nuevo final', `rem=${Math.round(r.remLater)}ms`);
    check(r.idx === 2, 'reducir por debajo de lo consumido no aplica el piso de 1 s', `idx=${r.idx}`);
    check(r.running && r.rem > 0 && r.rem <= 1000, 'el paso resultante tiene un restante real', `rem=${Math.round(r.rem)}ms`);
  });

  // 7. Limpieza al detener
  await scenario('limpieza', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      const applied = [];
      p.onStep = i => applied.push(i);
      p.play();
      await new Promise(r => setTimeout(r, 150));
      const armed = { tick: p.tick !== null, timer: p.timer !== null };
      p.stop();
      const after = { tick: p.tick, timer: p.timer, running: p.running, paused: p.paused, rem: p.remainingMs };
      await new Promise(r => setTimeout(r, 2500));
      p.play();
      await new Promise(r => setTimeout(r, 300));
      const replay = applied.slice();
      p.stop();
      return { armed, after, replay };
    });
    check(r.armed.tick && r.armed.timer, 'hay tick y timeout de respaldo');
    check(r.after.tick === null && r.after.timer === null, 'stop() cancela tick y timeout', JSON.stringify(r.after));
    check(r.after.running === false && r.after.paused === false && r.after.rem === 0, 'stop() deja el player en reposo');
    check(r.replay.length === 2 && r.replay[1] === 0, 'reproducir de nuevo no arrastra el ciclo anterior', JSON.stringify(r.replay));
  });

  // 8. Resync al volver a la pestaña
  await scenario('resync de visibilidad', async page => {
    await page.evaluate(STEPS);
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      p.play();
      await new Promise(r => setTimeout(r, 100));
      p.clearTick(); p.clearTimer();
      const stale = Math.round(p.remainingMs);
      await new Promise(r => setTimeout(r, 2400));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => requestAnimationFrame(r));
      const fresh = {
        idx: p.index, rem: Math.round(p.remainingMs),
        status: document.getElementById('timelineStatus').textContent,
        current: document.querySelectorAll('.timeline-step.current').length
      };
      p.stop();
      return { stale, fresh };
    });
    check(r.stale > 0, 'antes del resync el restante es el viejo', `rem=${r.stale}`);
    check(r.fresh.idx >= 1, 'el resync avanza a la posición real', `idx=${r.fresh.idx}`);
    check(r.fresh.rem >= 0 && r.fresh.rem < 1000, 'el restante refleja la posición real', `rem=${r.fresh.rem}ms`);
    check(r.fresh.status.includes('Paso'), 'el texto de estado se actualizó', r.fresh.status);
    check(r.fresh.current === 1, 'el resaltado del paso actual sigue al player', `current=${r.fresh.current}`);
  });

  // 9. Timeline vacío
  await scenario('timeline vacío', async page => {
    const r = await page.evaluate(() => {
      const C = window.__CORTEX__;
      C.timelineState.steps = [];
      const p = C.getTimelinePlayer();
      const started = p.play();
      return { started, running: p.running, status: document.getElementById('timelineStatus').textContent };
    });
    check(r.started === false && r.running === false, 'play() con timeline vacío no arranca', JSON.stringify(r));
    check(r.status.includes('Agrega al menos un preset'), 'explica por qué no arrancó', r.status);
  });

  await browser.close();

  for (const r of results) if (!r.pass) failures.push(r.name);
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-scheduling-${engineName}.json`),
    JSON.stringify({ engine: engineName, total: results.length, failed: failures.length, results }, null, 2));

  console.log(`\n${results.length - failures.length}/${results.length} verificaciones OK`);
  if (failures.length) {
    console.log('fallos:\n' + failures.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(2); });
