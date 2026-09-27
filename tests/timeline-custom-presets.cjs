const { chromium, firefox, webkit } = require('playwright');

(async () => {
  const engineName = process.env.ENGINE || 'chromium';
  const browserType = { chromium, firefox, webkit }[engineName];
  if (!browserType) throw new Error(`Unknown ENGINE: ${engineName}`);
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const failures = [];   // declarado arriba: la sonda de selección del clip 2 registra aquí
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/cortex.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('cortex-custom-presets-v1', '{bad-json');
    localStorage.setItem('cortex-timeline-v1', JSON.stringify({ steps: [{ durationSeconds: 0 }] }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  const corrupted = await page.evaluate(() => ({
    custom: window.__CORTEX__.getCustomPresets().length,
    steps: window.__CORTEX__.timelineState.steps.length,
  }));
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const c = window.__CORTEX__;
    Object.assign(c.state, { brainwave: 10, carrier: 300, amod: 20, binaural: 10, stereo: 5, fmod: 0, noise: 15, mix: 70 });
    c.syncUIFromState();
  });
  await page.click('#btnCreatePreset');
  await page.fill('#customPresetName', 'Mi Alpha');
  await page.locator('[data-emoji="🌊"]').click();
  await page.click('#btnSavePreset');

  const custom = await page.evaluate(() => window.__CORTEX__.getCustomPresets());
  const customId = custom[0] && custom[0].id;
  await page.click('#btnOpenTimeline');
  await page.locator('[data-add-preset="builtin-delta"]').click();
  await page.locator(`[data-add-preset="${customId}"]`).click();
  // El dock ya no tiene un input por paso: se selecciona el clip y la
  // duración se edita en el inspector. Se espera a que el inspector muestre
  // el paso elegido antes de editar: el fill contra un inspector que aún
  // refleja el paso anterior aplicaría sobre el paso equivocado.
  await page.locator('.dock-clip-btn').nth(0).click();
  await page.waitForFunction(() => document.getElementById('inspectorName').textContent.includes('Delta'));
  await page.fill('#inspectorDuration', '1');
  await page.dispatchEvent('#inspectorDuration', 'change');

  // Sonda de diagnóstico, nivel 2: grabar pointerdown/pointerup/click en el
  // documento (con objetivo y coordenadas) y mutaciones de la pista con marca
  // de tiempo. Si el navegador no sintetiza el click porque el nodo bajo el
  // puntero cambió entre down y up, la mutación queda registrada con su hora.
  await page.evaluate(() => {
    window.__ev__ = [];
    const rec = name => ev => {
      window.__ev__.push({
        name, t: Math.round(performance.now()),
        tag: ev.target.tagName, cls: String(ev.target.className).slice(0, 32),
        x: ev.clientX, y: ev.clientY,
      });
    };
    document.addEventListener('pointerdown', rec('pointerdown'), true);
    document.addEventListener('pointerup', rec('pointerup'), true);
    document.addEventListener('click', rec('click'), true);
    new MutationObserver(muts => {
      window.__ev__.push({
        name: 'mutacion-pista', t: Math.round(performance.now()),
        added: muts.reduce((n, m) => n + m.addedNodes.length, 0),
        removed: muts.reduce((n, m) => n + m.removedNodes.length, 0),
      });
    }).observe(document.getElementById('dockClips'), { childList: true });
  });
  await page.locator('.dock-clip-btn').nth(1).click();
  let selectedSecond = true;
  try {
    await page.waitForFunction(() => document.getElementById('inspectorName').textContent.includes('Mi Alpha'), null, { timeout: 4000 });
  } catch (e) { selectedSecond = false; }
  if (!selectedSecond) {
    // segundo intento sin actionability: aísla si el problema está en el
    // chequeo de hit-target de Playwright o en la entrega del evento
    await page.locator('.dock-clip-btn').nth(1).click({ force: true });
    try {
      await page.waitForFunction(() => document.getElementById('inspectorName').textContent.includes('Mi Alpha'), null, { timeout: 2000 });
    } catch (e) {
      const diag = await page.evaluate(() => ({
        eventos: window.__ev__,
        selectedStepIndex: window.__CORTEX__.getSelectedStepIndex(),
        inspectorName: document.getElementById('inspectorName').textContent,
        atSecondCenter: (() => {
          const b = document.querySelectorAll('.dock-clip-btn')[1];
          if (!b) return 'sin botón 2';
          const r = b.getBoundingClientRect();
          const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return el ? `${el.tagName}.${el.className}` : 'nada';
        })(),
        steps: window.__CORTEX__.timelineState.steps.map(s => ({ id: s.id, name: s.name, dur: s.durationSeconds })),
      }));
      const probe = await page.evaluate(() => {
        window.__CORTEX__.selectStep(1);
        return {
          selectedAfterApi: window.__CORTEX__.getSelectedStepIndex(),
          nameAfterApi: document.getElementById('inspectorName').textContent,
        };
      });
      failures.push(`selección del clip 2 (diagnóstico nivel 2): ${JSON.stringify({ diag, probe })}`);
    }
  }
  await page.fill('#inspectorDuration', '1');
  await page.dispatchEvent('#inspectorDuration', 'change');
  await page.check('#timelineLoop');

  const beforePlay = await page.evaluate(() => ({
    custom: window.__CORTEX__.getCustomPresets(),
    steps: window.__CORTEX__.timelineState.steps,
    loop: window.__CORTEX__.timelineState.loop,
    stepDurations: window.__CORTEX__.timelineState.steps.map(step => step.durationSeconds),
  }));

  await page.click('#btnTimelinePlay');
  await page.waitForTimeout(1150);
  const duringPlay = await page.evaluate(() => ({
    playing: window.__CORTEX__.state.playing,
    running: window.__CORTEX__.getTimelinePlayer().running,
    index: window.__CORTEX__.getTimelinePlayer().index,
    stateBand: window.__CORTEX__.state.band,
  }));
  await page.click('#btnTimelineStop');
  const afterStop = await page.evaluate(() => ({
    running: window.__CORTEX__.getTimelinePlayer().running,
    paused: window.__CORTEX__.getTimelinePlayer().paused,
    index: window.__CORTEX__.getTimelinePlayer().index,
  }));

  if (corrupted.custom !== 0 || corrupted.steps !== 0) failures.push(`corrupt storage: ${JSON.stringify(corrupted)}`);
  if (custom.length !== 1 || custom[0].name !== 'Mi Alpha' || custom[0].emoji !== '🌊' || custom[0].band !== 'alpha') failures.push(`custom preset: ${JSON.stringify(custom)}`);
  if (beforePlay.steps.length !== 2 || beforePlay.stepDurations.join(',') !== '1,1' || !beforePlay.loop) failures.push(`timeline setup: ${JSON.stringify(beforePlay)}`);
  if (!duringPlay.playing || !duringPlay.running) failures.push(`timeline play: ${JSON.stringify(duringPlay)}`);
  if (!afterStop || afterStop.running || afterStop.paused) failures.push(`timeline stop: ${JSON.stringify(afterStop)}`);
  if (errors.length) failures.push(`pageErrors=${errors.join(' | ')}`);

  const report = { engine: engineName, corrupted, beforePlay, duringPlay, afterStop, failures };
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-custom-presets-${engineName}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
