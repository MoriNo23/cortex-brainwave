/* Dock del timeline: clips proporcionales, playhead sobre el reloj de audio,
   selección con inspector, gestos y sus reemplazos, plegado/desplegado y
   presupuesto de alto.
   Spec: openspec/changes/cortex-timeline-dock/specs/timeline-dock/spec.md
   Los escenarios que no exigen reloj de audio van con needsClock:false para
   que corran también en Firefox headless (ver AGENTS.md). */
const fs = require('fs');
const path = require('path');
const { chromium, firefox, webkit } = require('playwright');

const engineName = process.env.ENGINE || 'chromium';
const browserType = { chromium, firefox, webkit }[engineName];
if (!browserType) throw new Error(`Unknown ENGINE: ${engineName}`);
const URL = `http://127.0.0.1:${process.env.PORT || 4173}/cortex.html`;

/* Pasos con snapshot mínimo pero válido: la suite mide la pista, no el audio. */
const SNAP = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
const STEPS = `(() => {
  const C = window.__CORTEX__;
  C.timelineState.steps = [
    { id:'d1', presetId:'builtin-delta', durationSeconds:10, snapshot:${JSON.stringify(SNAP(2))},  name:'Delta', emoji:'D', band:'delta' },
    { id:'t1', presetId:'builtin-theta', durationSeconds:20, snapshot:${JSON.stringify(SNAP(6))},  name:'Theta', emoji:'T', band:'theta' },
    { id:'a1', presetId:'builtin-alpha', durationSeconds:30, snapshot:${JSON.stringify(SNAP(10))}, name:'Alpha', emoji:'A', band:'alpha' },
  ];
  C.timelineState.loop = false;
  C.timelineState.transition.enabled = false;
  C.timelineState.transition.seconds = 0;
  C.timelineState.durationUnits.step = 's';
  C.renderTimeline();
  return true;
})()`;

fs.mkdirSync(path.join(process.cwd(), 'artifacts'), { recursive: true });

const results = [];
const skipped = [];
function check(cond, name, detail) {
  results.push({ name, pass: !!cond, detail: detail || '' });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const launchOptions = { headless: true };
  if (engineName === 'chromium') {
    launchOptions.args = ['--autoplay-policy=no-user-gesture-required'];
  }

  let browser;
  try {
    browser = await browserType.launch(launchOptions);
  } catch (e) {
    console.log(`BLOCKED  ${engineName} no disponible: ${e.message.split('\n')[0]}`);
    fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-dock-${engineName}.json`),
      JSON.stringify({ engine: engineName, status: 'BLOCKED', reason: e.message.split('\n')[0] }, null, 2));
    process.exit(0);
  }

  async function scenario(title, fn, { needsClock = true, viewport = null } = {}) {
    console.log(`\n-- ${title} --`);
    const page = viewport ? await browser.newPage({ viewport }) : await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    let clockReady = true;
    if (needsClock) {
      await page.click('#btnPlay');
      clockReady = await page.waitForFunction(
        () => { const c = window.__CORTEX__.engine.ctx; return Boolean(c) && c.state === 'running'; },
        null, { timeout: 8000 }
      ).then(() => true).catch(() => false);
      if (!clockReady) {
        const st = await page.evaluate(() => (window.__CORTEX__.engine.ctx || {}).state || 'none');
        console.log(`SKIP  ${title}: el reloj de audio no quedó disponible (ctx=${st}) — Firefox headless no habilita audio`);
        skipped.push(title);
        await page.close();
        return;
      }
    }
    try {
      await fn(page);
    } catch (e) {
      check(false, `${title}: sin excepción`, e.message);
    }
    check(errors.length === 0, `${title}: página sin errores`, errors.join(' | '));
    await page.close();
  }

  const expand = (page) => page.evaluate(() => {
    if (!window.__CORTEX__.state.dockExpanded) window.__CORTEX__.toggleDock();
  });
  const playheadX = () => {
    const raw = document.getElementById('dockPlayhead').style.transform || '';
    const m = /translateX\(([-0-9.]+)px\)/.exec(raw);
    return m ? Number(m[1]) : null;
  };

  // 1. Plegado/desplegado con persistencia de la preferencia
  await scenario('plegado/desplegado persistente', async page => {
    const state0 = await page.evaluate(() => document.getElementById('timelineDock').dataset.dockState);
    check(state0 === 'collapsed', 'arranca plegado por omisión', state0);
    await page.click('#btnOpenTimeline');
    const expanded = await page.evaluate(() => ({
      dockState: document.getElementById('timelineDock').dataset.dockState,
      ariaExpanded: document.getElementById('btnOpenTimeline').getAttribute('aria-expanded'),
      saved: (JSON.parse(localStorage.getItem('cortex-settings') || '{}')).dockExpanded,
      toolbarVisible: Boolean(document.getElementById('btnTimelinePlay').offsetParent),
    }));
    check(expanded.dockState === 'expanded', 'el toggle despliega el dock', expanded.dockState);
    check(expanded.ariaExpanded === 'true', 'el toggle anuncia aria-expanded', expanded.ariaExpanded);
    check(expanded.saved === true, 'la preferencia se guarda en cortex-settings', JSON.stringify(expanded.saved));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    const afterReload = await page.evaluate(() => document.getElementById('timelineDock').dataset.dockState);
    check(afterReload === 'expanded', 'tras recargar sigue desplegado', afterReload);
    await page.click('#btnOpenTimeline');
    const collapsed = await page.evaluate(() => ({
      dockState: document.getElementById('timelineDock').dataset.dockState,
      bodyHidden: getComputedStyle(document.getElementById('dockBody')).display === 'none',
      saved: (JSON.parse(localStorage.getItem('cortex-settings') || '{}')).dockExpanded,
    }));
    check(collapsed.dockState === 'collapsed' && collapsed.bodyHidden, 'el toggle vuelve a plegar', JSON.stringify(collapsed));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');
    const afterReload2 = await page.evaluate(() => document.getElementById('timelineDock').dataset.dockState);
    check(afterReload2 === 'collapsed', 'tras recargar sigue plegado', afterReload2);
    // la preferencia se mezcla sin borrar el resto de los ajustes guardados
    const merged = await page.evaluate(() => {
      window.__CORTEX__.saveSettings();
      window.__CORTEX__.toggleDock();
      const raw = JSON.parse(localStorage.getItem('cortex-settings') || '{}');
      return { brainwave: raw.brainwave, dockExpanded: raw.dockExpanded };
    });
    check(merged.brainwave === 10 && merged.dockExpanded === true, 'el guardado mezcla audio y preferencia', JSON.stringify(merged));
  }, { needsClock: false });

  // 2. Clips proporcionales + ancho mínimo legible
  await scenario('proporcionalidad de clips', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    const r = await page.evaluate(() => {
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      const w = clips.map(c => c.offsetWidth);
      const chips = [...document.querySelectorAll('[data-clip-chip]')].map(c => c.textContent.trim());
      return { w, chips };
    });
    check(r.w.length === 3, 'hay tres clips', String(r.w.length));
    check(r.w[2] > r.w[1] && r.w[1] > r.w[0], '30 s > 20 s > 10 s en ancho', r.w.join(','));
    const ratio = r.w[2] / r.w[0];
    check(Math.abs(ratio - 3) < 0.35, 'la proporción 30/10 ronda 3 dentro de la tolerancia', ratio.toFixed(3));
    check(r.chips.join('|') === '10 s|20 s|30 s', 'los chips muestran el valor exacto en la unidad vigente', r.chips.join('|'));
    const min = await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [1, 1, 1, 300].map((d, i) => ({
        id: 'x' + i, presetId: 'builtin-alpha', durationSeconds: d, snapshot: snap(10), name: 'S' + i, emoji: 'A', band: 'alpha',
      }));
      C.renderTimeline();
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      return clips.map(c => c.offsetWidth);
    });
    check(min.slice(0, 3).every(w => w >= 44), 'un paso muy corto conserva el ancho mínimo de 44 px', min.join(','));
    check(min[3] > min[0], 'el paso largo sigue siendo visiblemente más ancho', min.join(','));
  }, { needsClock: false });

  // 3. La regla de tiempos coincide con los límites de los clips
  await scenario('regla de tiempos', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    const r = await page.evaluate(() => {
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      const segs = [...document.querySelectorAll('#dockRuler .dock-ruler-segment')];
      // getBoundingClientRect: coordenadas de viewport, inmunes a que los
      // clips y los segmentos tengan distintos offsetParent.
      const edges = clips.map(c => c.getBoundingClientRect().right);
      const segEdges = segs.map(s => s.getBoundingClientRect().right);
      const maxDiff = Math.max(...edges.map((e, i) => Math.abs(e - segEdges[i])));
      const labels = [...document.querySelectorAll('.dock-ruler-label')].map(l => l.textContent.trim());
      return { count: segs.length, labels, maxDiff };
    });
    check(r.count === 3, 'la regla tiene un segmento por paso', String(r.count));
    check(r.maxDiff <= 1, 'las marcas coinciden con los límites de los clips', `maxDiff=${r.maxDiff}px`);
    check(r.labels.join('|') === '10 s|30 s|60 s', 'las marcas acumulan el tiempo en la unidad vigente', r.labels.join('|'));
  }, { needsClock: false });

  // 4. Selección por click + inspector completo
  await scenario('selección e inspector', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    await page.locator('.dock-clip-btn').nth(0).click();
    const sel = await page.evaluate(() => ({
      selected: document.querySelectorAll('.dock-clip.selected').length,
      inspectorHidden: document.getElementById('dockInspector').hidden,
      name: document.getElementById('inspectorName').textContent,
      value: document.getElementById('inspectorDuration').value,
    }));
    check(sel.selected === 1, 'solo un clip queda seleccionado', String(sel.selected));
    check(!sel.inspectorHidden, 'el inspector se abre con la selección');
    check(sel.name.includes('Delta'), 'el inspector muestra el paso', sel.name);
    check(sel.value === '10', 'el editor muestra la duración en segundos', sel.value);
    const widthBefore = await page.evaluate(() => document.querySelector('#dockClips .dock-clip').offsetWidth);
    await page.fill('#inspectorDuration', '90');
    await page.dispatchEvent('#inspectorDuration', 'change');
    const edited = await page.evaluate(() => ({
      seconds: window.__CORTEX__.timelineState.steps[0].durationSeconds,
      chip: document.querySelector('[data-clip-chip]').textContent.trim(),
      stored: (JSON.parse(localStorage.getItem('cortex-timeline-v1'))).steps[0].durationSeconds,
      width: document.querySelector('#dockClips .dock-clip').offsetWidth,
      value: document.getElementById('inspectorDuration').value,
    }));
    check(edited.seconds === 90, 'la duración guardada es 90 s', String(edited.seconds));
    check(edited.stored === 90, 'la edición persiste en cortex-timeline-v1', String(edited.stored));
    check(edited.chip === '90 s', 'el chip se actualiza', edited.chip);
    check(edited.width > widthBefore, 'el ancho del clip crece con la duración', `${widthBefore} → ${edited.width}`);
    // duplicar y eliminar desde el inspector
    await page.click('#inspectorDuplicate');
    const dup = await page.evaluate(() => ({
      count: window.__CORTEX__.timelineState.steps.length,
      selectedName: document.getElementById('inspectorName').textContent,
    }));
    check(dup.count === 4, 'duplicar agrega un paso', String(dup.count));
    check(dup.selectedName.includes('Delta'), 'la selección sigue al duplicado', dup.selectedName);
    await page.click('#inspectorRemove');
    const rem = await page.evaluate(() => window.__CORTEX__.timelineState.steps.length);
    check(rem === 3, 'eliminar quita un paso', String(rem));
    // mover con los botones (reemplazo por teclado del arrastre)
    await page.evaluate(() => window.__CORTEX__.selectStep(0));
    await page.click('#inspectorMoveDown');
    const moved = await page.evaluate(() => window.__CORTEX__.timelineState.steps.map(s => s.name));
    check(moved.join(',') === 'Theta,Delta,Alpha', 'mover con el inspector reordena', moved.join(','));
    const stored = await page.evaluate(() => (JSON.parse(localStorage.getItem('cortex-timeline-v1'))).steps.map(s => s.name));
    check(stored.join(',') === 'Theta,Delta,Alpha', 'el reorden persiste', stored.join(','));
  }, { needsClock: false });

  // 5. Doble click aplica el preset
  await scenario('doble click aplica el preset', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    await page.locator('.dock-clip-btn').nth(0).dblclick();
    const bw = await page.evaluate(() => window.__CORTEX__.state.brainwave);
    check(bw === 2, 'el doble click aplica el snapshot del paso (Delta = 2 Hz)', String(bw));
  }, { needsClock: false });

  // 6. Arrastre horizontal reordena y persiste
  await scenario('arrastre reordena', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    const boxes = await page.evaluate(() => [...document.querySelectorAll('#dockClips .dock-clip')]
      .map(c => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
    const from = { x: boxes[0].x + boxes[0].w / 2, y: boxes[0].y + boxes[0].h / 2 };
    const to = { x: boxes[2].x + boxes[2].w * 0.75, y: from.y };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    const afterDrag = await page.evaluate(() => ({
      order: window.__CORTEX__.timelineState.steps.map(s => s.name),
      stored: (JSON.parse(localStorage.getItem('cortex-timeline-v1'))).steps.map(s => s.name),
      dropLineVisible: document.getElementById('dockDropLine').classList.contains('visible'),
    }));
    check(afterDrag.order.join(',') === 'Theta,Alpha,Delta', 'soltar sobre el último reordena', afterDrag.order.join(','));
    check(afterDrag.stored.join(',') === 'Theta,Alpha,Delta', 'el reorden por arrastre persiste', afterDrag.stored.join(','));
    check(!afterDrag.dropLineVisible, 'la línea de destino se retira al soltar');
    // el reemplazo por teclado produce el mismo resultado
    await page.evaluate(STEPS);
    await page.evaluate(() => window.__CORTEX__.selectStep(0));
    await page.click('#inspectorMoveDown');
    await page.click('#inspectorMoveDown');
    const byKeyboard = await page.evaluate(() => window.__CORTEX__.timelineState.steps.map(s => s.name));
    check(byKeyboard.join(',') === 'Theta,Alpha,Delta', 'mover dos veces con teclado da el mismo orden', byKeyboard.join(','));
  }, { needsClock: false });

  // 7. Redimensionado por el borde derecho con snap
  await scenario('redimensionado con snap', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    const clip = await page.locator('#dockClips .dock-clip').nth(0).boundingBox();
    const startX = clip.x + clip.width - 4;   // dentro de la zona de 8 px
    const y = clip.y + clip.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(startX + 10, y, { steps: 4 });
    await page.mouse.move(startX + 45, y, { steps: 8 });
    await page.mouse.up();
    const resized = await page.evaluate(() => ({
      seconds: window.__CORTEX__.timelineState.steps[0].durationSeconds,
      chip: document.querySelector('#dockClips [data-clip-chip]').textContent.trim(),
      stored: (JSON.parse(localStorage.getItem('cortex-timeline-v1'))).steps[0].durationSeconds,
      before: 10,
    }));
    check(Number.isInteger(resized.seconds) && resized.seconds > resized.before, 'el redimensionado sube la duración con snap de 1 s', String(resized.seconds));
    check(resized.stored === resized.seconds, 'la nueva duración persiste', `${resized.stored} vs ${resized.seconds}`);
    check(resized.chip === `${resized.seconds} s`, 'el chip muestra la duración resultante', resized.chip);
    // el tope: un clip largo arrastrado lejos no excede 3600 s
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [
        { id: 'long1', presetId: 'builtin-alpha', durationSeconds: 3000, snapshot: snap(10), name: 'Largo', emoji: 'A', band: 'alpha' },
        { id: 'long2', presetId: 'builtin-delta', durationSeconds: 3000, snapshot: snap(2), name: 'Largo2', emoji: 'D', band: 'delta' },
      ];
      C.renderTimeline();
      return true;
    });
    const longClip = await page.locator('#dockClips .dock-clip').nth(0).boundingBox();
    await page.mouse.move(longClip.x + longClip.width - 4, longClip.y + longClip.height / 2);
    await page.mouse.down();
    await page.mouse.move(longClip.x + longClip.width + 200, longClip.y + longClip.height / 2, { steps: 10 });
    await page.mouse.up();
    const clamped = await page.evaluate(() => window.__CORTEX__.timelineState.steps[0].durationSeconds);
    check(clamped === 3600, 'el resultado queda dentro del límite de 3600 s', String(clamped));
    // en minutos, el snap es de 30 s
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [
        { id: 'm1', presetId: 'builtin-alpha', durationSeconds: 90, snapshot: snap(10), name: 'Noventa', emoji: 'A', band: 'alpha' },
        { id: 'm2', presetId: 'builtin-delta', durationSeconds: 30, snapshot: snap(2), name: 'Treinta', emoji: 'D', band: 'delta' },
      ];
      C.setDurationUnit('step', 'min');
      C.renderTimeline();
      return true;
    });
    const minClip = await page.locator('#dockClips .dock-clip').nth(0).boundingBox();
    await page.mouse.move(minClip.x + minClip.width - 4, minClip.y + minClip.height / 2);
    await page.mouse.down();
    await page.mouse.move(minClip.x + minClip.width + 300, minClip.y + minClip.height / 2, { steps: 6 });
    await page.mouse.up();
    const inMinutes = await page.evaluate(() => ({
      seconds: window.__CORTEX__.timelineState.steps[0].durationSeconds,
      chip: document.querySelector('#dockClips [data-clip-chip]').textContent.trim(),
    }));
    check(inMinutes.seconds % 30 === 0 && inMinutes.seconds !== 90, 'en minutos el snap es múltiplo de 30 s', String(inMinutes.seconds));
    check(inMinutes.chip.includes('min'), 'el chip muestra la unidad vigente', inMinutes.chip);
  }, { needsClock: false });

  // 8. Plegado: transporte visible y barra fina de progreso
  await scenario('plegado con barra de progreso', async page => {
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [
        { id: 'p1', presetId: 'builtin-delta', durationSeconds: 2, snapshot: snap(2), name: 'Delta', emoji: 'D', band: 'delta' },
        { id: 'p2', presetId: 'builtin-alpha', durationSeconds: 2, snapshot: snap(10), name: 'Alpha', emoji: 'A', band: 'alpha' },
      ];
      C.renderTimeline();
    });
    const collapsedState = await page.evaluate(() => ({
      dockState: document.getElementById('timelineDock').dataset.dockState,
      playVisible: Boolean(document.getElementById('btnTimelinePlay').offsetParent),
      status: document.getElementById('timelineStatus').textContent,
    }));
    check(collapsedState.dockState === 'collapsed', 'el dock queda plegado', collapsedState.dockState);
    check(collapsedState.playVisible, 'el transporte sigue disponible plegado');
    await page.click('#btnTimelinePlay');
    const r = await page.waitForFunction(() => {
      const raw = document.getElementById('dockProgressFill').style.transform || '';
      const m = /scaleX\(([-0-9.]+)\)/.exec(raw);
      return m && Number(m[1]) > 0.02;
    }, null, { timeout: 3000 }).then(() => true).catch(() => false);
    check(r, 'la barra fina de progreso avanza mientras suena');
    const status = await page.evaluate(() => document.getElementById('timelineStatus').textContent);
    check(status.includes('Paso 1/2'), 'el paso en curso y su restante se ven sin desplegar', status);
    await page.evaluate(() => window.__CORTEX__.getTimelinePlayer().stop());
  }, { needsClock: true });

  // 9. Playhead: avance dentro del clip y cruce al siguiente, sin tocar el layout de los clips
  await scenario('playhead avanza y cruza', async page => {
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [
        { id: 'p1', presetId: 'builtin-delta', durationSeconds: 2, snapshot: snap(2), name: 'Delta', emoji: 'D', band: 'delta' },
        { id: 'p2', presetId: 'builtin-alpha', durationSeconds: 2, snapshot: snap(10), name: 'Alpha', emoji: 'A', band: 'alpha' },
      ];
      C.renderTimeline();
    });
    await expand(page);
    await page.click('#btnTimelinePlay');
    const early = await page.evaluate(async () => {
      const read = () => ({
        x: (() => { const raw = document.getElementById('dockPlayhead').style.transform || ''; const m = /translateX\(([-0-9.]+)px\)/.exec(raw); return m ? Number(m[1]) : null; })(),
        clip0: (() => { const c = document.querySelector('#dockClips .dock-clip'); return { left: c.offsetLeft, width: c.offsetWidth }; })(),
      });
      await new Promise(r => requestAnimationFrame(r));
      const a = read();
      await new Promise(r => setTimeout(r, 500));
      const b = read();
      return { a, b, visible: document.getElementById('dockPlayhead').classList.contains('visible') };
    });
    check(early.visible, 'el playhead es visible mientras suena');
    check(early.a.x !== null && early.a.x >= early.a.clip0.left && early.a.x <= early.a.clip0.left + early.a.clip0.width,
      'arranca dentro del primer clip', `x=${early.a.x} clip=[${early.a.clip0.left},${early.a.clip0.left + early.a.clip0.width}]`);
    check(early.b.x > early.a.x, 'avanza con el reloj dentro del clip', `${early.a.x} → ${early.b.x}`);
    check(early.b.clip0.left === early.a.clip0.left && early.b.clip0.width === early.a.clip0.width,
      'los clips no se re-maquetan mientras el playhead avanza');
    const crossed = await page.waitForFunction(() => {
      const p = window.__CORTEX__.getTimelinePlayer();
      const raw = document.getElementById('dockPlayhead').style.transform || '';
      const m = /translateX\(([-0-9.]+)px\)/.exec(raw);
      return p.index === 1 && m && Number(m[1]) > 0;
    }, null, { timeout: 4000 }).then(() => true).catch(() => false);
    check(crossed, 'cruza al clip siguiente al cambiar de paso');
    const inSecond = await page.evaluate(() => {
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      const raw = document.getElementById('dockPlayhead').style.transform || '';
      const m = /translateX\(([-0-9.]+)px\)/.exec(raw);
      const x = m ? Number(m[1]) : null;
      return { x, left: clips[1].offsetLeft, width: clips[1].offsetWidth };
    });
    check(inSecond.x >= inSecond.left && inSecond.x <= inSecond.left + inSecond.width,
      'en el segundo paso el playhead está dentro del segundo clip', `x=${inSecond.x} clip=[${inSecond.left},${inSecond.left + inSecond.width}]`);
    await page.evaluate(() => window.__CORTEX__.getTimelinePlayer().stop());
    const hidden = await page.evaluate(async () => {
      // la clase la retira el pase del rAF: esperar el frame antes de leer
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return !document.getElementById('dockPlayhead').classList.contains('visible');
    });
    check(hidden, 'al detener el playhead deja de verse');
  }, { needsClock: true });

  // 10. Loop: el playhead vuelve a arrancar
  await scenario('loop reinicia el playhead', async page => {
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [
        { id: 'p1', presetId: 'builtin-delta', durationSeconds: 1, snapshot: snap(2), name: 'Delta', emoji: 'D', band: 'delta' },
        { id: 'p2', presetId: 'builtin-alpha', durationSeconds: 1, snapshot: snap(10), name: 'Alpha', emoji: 'A', band: 'alpha' },
      ];
      C.timelineState.loop = true;
      C.renderTimeline();
    });
    await expand(page);
    await page.click('#btnTimelinePlay');
    const r = await page.evaluate(async () => {
      const read = () => {
        const raw = document.getElementById('dockPlayhead').style.transform || '';
        const m = /translateX\(([-0-9.]+)px\)/.exec(raw);
        return { idx: window.__CORTEX__.getTimelinePlayer().index, x: m ? Number(m[1]) : null };
      };
      const samples = [];
      for (let i = 0; i < 32; i++) {
        samples.push(read());
        await new Promise(r2 => setTimeout(r2, 100));
      }
      window.__CORTEX__.getTimelinePlayer().stop();
      return samples;
    });
    const firstPass = r.find(s => s.idx === 0 && s.x !== null && s.x > 0);
    const inSecond = r.find(s => s.idx === 1 && s.x !== null && s.x > 0);
    const wrapped = r.find((s, i) => i > r.indexOf(inSecond) && s.idx === 0 && s.x !== null && s.x >= 0 && s.x < (inSecond ? inSecond.x : Infinity));
    check(Boolean(firstPass), 'hay avance dentro del primer paso');
    check(Boolean(inSecond), 'el playhead llega al segundo clip');
    check(Boolean(wrapped), 'el loop vuelve a arrancar desde el primer clip', JSON.stringify(r.filter(s => s.x !== null).slice(-6)));
  }, { needsClock: true });

  // 11. Resync al volver de segundo plano
  await scenario('resync al volver de segundo plano', async page => {
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = [2, 2, 2].map((d, i) => ({
        id: 'r' + i, presetId: 'builtin-delta', durationSeconds: d, snapshot: snap(2), name: 'S' + i, emoji: 'D', band: 'delta',
      }));
      C.renderTimeline();
    });
    await expand(page);
    await page.click('#btnTimelinePlay');
    const r = await page.evaluate(async () => {
      const C = window.__CORTEX__, p = C.getTimelinePlayer();
      await new Promise(r => setTimeout(r, 150));
      p.clearTick(); p.clearTimer();
      await new Promise(r => setTimeout(r, 2600));
      const stale = { idx: p.index, x: (() => { const raw = document.getElementById('dockPlayhead').style.transform || ''; const m = /translateX\(([-0-9.]+)px\)/.exec(raw); return m ? Number(m[1]) : null; })() };
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      // medir la geometría ANTES de stop(): el re-render de stop desconecta
      // los nodos y un offsetWidth posterior leería cero
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      const clip1 = { left: clips[1].offsetLeft, width: clips[1].offsetWidth };
      const fresh = {
        idx: p.index,
        x: (() => { const raw = document.getElementById('dockPlayhead').style.transform || ''; const m = /translateX\(([-0-9.]+)px\)/.exec(raw); return m ? Number(m[1]) : null; })(),
        status: document.getElementById('timelineStatus').textContent,
      };
      p.stop();
      return { stale, fresh, clip1 };
    });
    check(r.fresh.idx >= 1, 'al volver, la posición real está en un paso posterior', `idx=${r.fresh.idx} (stale idx=${r.stale.idx})`);
    check(r.fresh.x !== null && r.fresh.x >= r.clip1.left && r.fresh.x <= r.clip1.left + r.clip1.width,
      'el playhead refleja la posición real, no una congelada', `x=${r.fresh.x} clip=[${r.clip1.left},${r.clip1.left + r.clip1.width}]`);
    check(r.fresh.status.includes('Paso'), 'el estado se actualiza al volver', r.fresh.status);
  }, { needsClock: true });

  // 12. Presupuesto de alto en 1366×768 con el dock desplegado
  await scenario('presupuesto de alto 1366×768', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    await page.evaluate(() => window.__CORTEX__.selectStep(0));   // peor caso: inspector abierto
    const r = await page.evaluate(() => {
      const rect = el => el.getBoundingClientRect();
      const dock = rect(document.getElementById('timelineDock'));
      const bar = rect(document.querySelector('.status-bar'));
      const brain = rect(document.querySelector('.brain-svg'));
      const play = rect(document.getElementById('btnTimelinePlay'));
      return {
        vh: window.innerHeight,
        dockHeight: dock.height,
        barTop: bar.top, barBottom: bar.bottom,
        brainTop: brain.top, brainHeight: brain.height,
        playTop: play.top, playBottom: play.bottom,
      };
    });
    check(r.barBottom <= r.vh && r.barTop > 0, 'la barra de estado queda visible', `bar=[${r.barTop},${r.barBottom}] vh=${r.vh}`);
    check(r.brainHeight > 100 && r.brainTop >= 52, 'la zona cerebral sigue visible', `brain top=${r.brainTop} h=${r.brainHeight}`);
    check(r.playBottom <= r.vh && r.playTop > 0, 'el transporte no queda oculto', `play=[${r.playTop},${r.playBottom}]`);
    check(r.dockHeight <= 240, 'el dock desplegado respeta el presupuesto (~170 px + margen)', `dockHeight=${r.dockHeight}`);
  }, { needsClock: false, viewport: { width: 1366, height: 768 } });

  // 13. Ancho estrecho: la pista scrollea, la página no desborda
  await scenario('ancho estrecho 390×844', async page => {
    await page.evaluate(() => {
      const C = window.__CORTEX__;
      const snap = (bw) => ({ brainwave: bw, carrier: 200, amod: 0, binaural: 0, stereo: 0, fmod: 0, noise: 0, mix: 80 });
      C.timelineState.steps = Array.from({ length: 10 }, (_, i) => ({
        id: 'n' + i, presetId: 'builtin-alpha', durationSeconds: 30, snapshot: snap(10), name: 'S' + i, emoji: 'A', band: 'alpha',
      }));
      C.renderTimeline();
    });
    await expand(page);
    const r = await page.evaluate(() => {
      const track = document.getElementById('dockTrack');
      const clips = document.getElementById('dockClips');
      const play = document.getElementById('btnTimelinePlay').getBoundingClientRect();
      return {
        pageScrollW: document.documentElement.scrollWidth,
        vw: window.innerWidth,
        trackScrollable: track.scrollWidth > track.clientWidth,
        clipsMin: [...document.querySelectorAll('#dockClips .dock-clip')].every(c => c.offsetWidth >= 44),
        playInside: play.left >= 0 && play.right <= window.innerWidth,
        clipSample: [...document.querySelectorAll('#dockClips .dock-clip')].slice(0, 3).map(c => c.offsetWidth),
      };
    });
    check(r.pageScrollW <= r.vw, 'la página no desborda horizontalmente', `scrollW=${r.pageScrollW} vw=${r.vw}`);
    check(r.trackScrollable, 'la pista scrollea horizontal en vez de desbordar', JSON.stringify(r.clipSample));
    check(r.clipsMin, 'los clips conservan el ancho mínimo en pantallas angostas');
    check(r.playInside, 'el transporte sigue usable a 390 px');
  }, { needsClock: false, viewport: { width: 390, height: 844 } });

  // 14. Accesibilidad del dock
  await scenario('accesibilidad del dock', async page => {
    await page.evaluate(STEPS);
    await expand(page);
    await page.locator('.dock-clip-btn').nth(0).click();
    const r = await page.evaluate(() => {
      const clips = [...document.querySelectorAll('#dockClips .dock-clip')];
      const buttons = [...document.querySelectorAll('.dock-clip-btn')];
      const units = [...document.querySelectorAll('#timelineDock .duration-unit-option')];
      return {
        trackRole: document.getElementById('dockClips').getAttribute('role'),
        clipRoles: clips.map(c => c.getAttribute('role')),
        labeled: buttons.every(b => (b.getAttribute('aria-label') || '').length > 0),
        described: buttons.every(b => b.getAttribute('aria-describedby') === 'dockGestureHint'),
        inspectorRole: document.getElementById('dockInspector').getAttribute('role'),
        unitsPressed: units.every(b => ['true', 'false'].includes(b.getAttribute('aria-pressed'))),
        toggleExpanded: document.getElementById('btnOpenTimeline').getAttribute('aria-expanded'),
        hint: (document.getElementById('dockGestureHint').textContent || '').length > 0,
        statusRole: document.getElementById('timelineStatus').getAttribute('role'),
      };
    });
    check(r.trackRole === 'list', 'la pista es una lista', r.trackRole);
    check(r.clipRoles.every(x => x === 'listitem'), 'los clips son ítems de lista', r.clipRoles.join(','));
    check(r.labeled, 'cada clip está etiquetado con nombre, banda y duración');
    check(r.described, 'los gestos apuntan a su reemplazo por teclado');
    check(r.inspectorRole === 'toolbar', 'el inspector es un toolbar', r.inspectorRole);
    check(r.unitsPressed, 'los botones de unidad tienen aria-pressed');
    check(r.toggleExpanded === 'true', 'el toggle anuncia su estado', r.toggleExpanded);
    check(r.hint, 'la ayuda de gestos existe y no está vacía');
    check(r.statusRole === 'status', 'el estado del timeline es un live region', r.statusRole);
  }, { needsClock: false });

  await browser.close();
  const failures = results.filter(x => !x.pass).map(x => x.name + (x.detail ? ` (${x.detail})` : ''));
  fs.writeFileSync(path.join(process.cwd(), 'artifacts', `timeline-dock-${engineName}.json`),
    JSON.stringify({ engine: engineName, total: results.length, failed: failures.length, skipped, results }, null, 2));
  console.log(`\n${results.length - failures.length}/${results.length} verificaciones OK` +
    (skipped.length ? ` · ${skipped.length} omitidas por reloj de audio` : ''));
  if (failures.length) {
    console.log('fallos:\n' + failures.map(f => ' - ' + f).join('\n'));
    process.exit(1);
  }
})().catch(e => { console.error(e); process.exit(2); });
