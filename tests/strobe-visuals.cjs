/* Estrobo en el shell Astro: play/stop, sync Brainwave, Hz propio, mini player,
   pantalla completa, ventana flotante (PiP) y comportamiento con la pestaña
   oculta. Cubre la tarea 8.3 del cambio `cortex-astro-redesign-strobe`.

   La ventana flotante no se puede abrir de verdad en un runner headless (no hay
   gestor de ventanas), así que el test verifica la decisión: o el navegador la
   abre y el panel se muda ahí, o se degrada a mini player con aviso y sin
   errores en consola. Las dos salidas son correctas; lo que no se acepta es un
   estado intermedio roto. */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  attachPageErrorCapture,
  cortexBaseUrl,
  ensureArtifactsDir,
  launchBrowserOrReport,
} = require('./cortex-browser-helpers.cjs');

async function centroDelFlash(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('strobeCanvas');
    if (!canvas || !canvas.width || !canvas.height) return null;
    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
    return { r: pixel[0], g: pixel[1], b: pixel[2] };
  });
}

(async () => {
  const artifactsDir = ensureArtifactsDir();
  const visualDir = ensureArtifactsDir('visual');
  const reportFile = path.join(artifactsDir, 'strobe-visuals-chromium.json');
  const screenshotFile = path.join(visualDir, 'strobe-visuals.png');

  const launch = await launchBrowserOrReport({
    browserType: chromium,
    engineName: 'chromium',
    launchOptions: { headless: true },
    reportFile,
    reportData: { route: '/' },
  });
  if (launch.blocked) process.exit(0);

  const browser = launch.browser;
  /* Un solo contexto para las dos pestañas. `browser.newPage()` crea un
     contexto propio con `_ownerPage`, y añadirle una segunda pestaña lanza
     "Please use browser.newContext()". Sin contexto común, traer la otra
     pestaña al frente no oculta esta, y el paso 7 comprueba justamente eso. */
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const capture = attachPageErrorCapture(page);

  await page.goto(`${cortexBaseUrl()}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof window.__CORTEX__ === 'object');

  const failures = [];
  /* Casos que el entorno no puede montar. No son fallos de la app: el
     Chromium headless de CI arranca con `--headless` (modo antiguo) y sin
     gestor de ventanas, de modo que `bringToFront` no oculta la pestaña
     anterior y `document.hidden` no cambia. Se reportan aparte para no
     dar un verde vacío ni castigar a la app por algo que no controla. */
  const skipped = [];
  const initial = await page.evaluate(() => ({
    active: Boolean(window.__CORTEX__.session.state.strobe.active),
    presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
    running: document.getElementById('strobePanel')?.dataset.strobeRunning || 'missing',
    hasFloatButton: Boolean(document.getElementById('btnStrobeFloat')),
    placeholderHidden: document.getElementById('strobePipPlaceholder')?.hidden !== false,
    capability: window.__CORTEX__.strobe.getPipCapability(),
  }));
  if (initial.active) failures.push('strobe-arranca-activo');
  if (initial.presentation !== 'integrated') failures.push(`presentacion-inicial=${initial.presentation}`);
  if (!initial.hasFloatButton) failures.push('falta-boton-ventana-flotante');
  if (!initial.placeholderHidden) failures.push('placeholder-visible-sin-ventana');

  /* ── 1. Play: la superficie tiene que alternar de verdad ── */
  await page.click('#btnStrobePlay');
  const muestras = [];
  for (let i = 0; i < 12; i += 1) {
    await page.waitForTimeout(40);
    muestras.push(await centroDelFlash(page));
  }
  const rojos = muestras.filter((m) => m && m.r > 180).length;
  const apagados = muestras.filter((m) => m && m.r < 80).length;
  const afterPlay = await page.evaluate(() => ({
    active: Boolean(window.__CORTEX__.session.state.strobe.active),
    running: document.getElementById('strobePanel')?.dataset.strobeRunning || 'missing',
    label: document.getElementById('btnStrobePlay')?.textContent || '',
    hz: document.getElementById('strobeHzLabel')?.textContent || '',
  }));
  if (!afterPlay.active) failures.push('play-no-activa');
  if (afterPlay.running !== 'on') failures.push(`estado-running=${afterPlay.running}`);
  if (rojos === 0 || apagados === 0) {
    failures.push(`la-superficie-no-alterna: encendidos=${rojos} apagados=${apagados}`);
  }

  /* ── 2. Sync Brainwave: el flash sigue al control principal ── */
  const sync = await page.evaluate(() => {
    const slider = document.getElementById('sliderBrainwave');
    slider.value = '20';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      mode: window.__CORTEX__.session.state.strobe.mode,
      effectiveHz: window.__CORTEX__.strobe.effectiveStrobeHz(),
      label: document.getElementById('strobeModeLabel')?.textContent || '',
    };
  });
  if (sync.mode !== 'sync' || Math.abs(sync.effectiveHz - 20) > 0.01) {
    failures.push(`sync-brainwave=${JSON.stringify(sync)}`);
  }
  if (sync.label !== 'Sync Brainwave') failures.push(`etiqueta-modo=${sync.label}`);

  /* ── 3. Frecuencia propia: independiente del audio ── */
  await page.click('#strobeModeCustom');
  const custom = await page.evaluate(() => {
    const slider = document.getElementById('sliderStrobeHz');
    slider.value = '7.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      mode: window.__CORTEX__.session.state.strobe.mode,
      customHz: window.__CORTEX__.session.state.strobe.customHz,
      effectiveHz: window.__CORTEX__.strobe.effectiveStrobeHz(),
      brainwave: window.__CORTEX__.session.state.brainwave,
      sliderDisabled: document.getElementById('sliderStrobeHz')?.disabled === true,
    };
  });
  if (custom.mode !== 'custom' || Math.abs(custom.customHz - 7.5) > 0.01 || Math.abs(custom.effectiveHz - 7.5) > 0.01) {
    failures.push(`hz-propio=${JSON.stringify(custom)}`);
  }
  if (Math.abs(custom.brainwave - 20) > 0.01) failures.push('hz-propio-movio-el-brainwave');
  if (custom.sliderDisabled) failures.push('slider-hz-deshabilitado-en-modo-propio');

  /* ── 4. Mini player ── */
  await page.click('#btnStrobeMini');
  const mini = await page.evaluate(() => ({
    presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
    position: getComputedStyle(document.getElementById('strobePanel')).position,
    playVisible: Boolean(document.getElementById('btnStrobePlay')?.offsetParent),
    stopVisible: Boolean(document.getElementById('btnStrobeStop')?.offsetParent),
    button: document.getElementById('btnStrobeMini')?.textContent || '',
  }));
  if (mini.presentation !== 'mini' || mini.position !== 'fixed') {
    failures.push(`mini-player=${JSON.stringify(mini)}`);
  }
  if (!mini.playVisible || !mini.stopVisible) failures.push('mini-sin-transporte');
  await page.click('#btnStrobeMini');

  /* ── 5. Pantalla completa: entra o avisa, nunca deja un rechazo suelto ── */
  await page.click('#btnStrobeFullscreen');
  await page.waitForTimeout(400);
  const fullscreen = await page.evaluate(() => ({
    isFullscreen: document.fullscreenElement === document.getElementById('strobePanel'),
    presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
    button: document.getElementById('btnStrobeFullscreen')?.textContent || '',
    toast: document.getElementById('toast')?.textContent || '',
  }));
  if (fullscreen.isFullscreen) {
    if (fullscreen.presentation !== 'fullscreen') failures.push(`fullscreen-presentacion=${fullscreen.presentation}`);
    const box = await page.evaluate(() => {
      const wrap = document.querySelector('.strobe-surface-wrap').getBoundingClientRect();
      return { alto: wrap.height, viewport: innerHeight };
    });
    if (box.alto > box.viewport) failures.push(`superficie-recortada-en-fullscreen=${JSON.stringify(box)}`);
    await page.keyboard.press('Escape');
    /* En headless la pulsación sintética de Escape no siempre surte efecto
       sobre la pantalla completa. Se espera la transición de verdad y, si no
       llega, se sale por la API para no arrastrar el estado al paso 6, donde
       la app rechaza abrir la ventana flotante mientras haya fullscreen. */
    const salio = await page
      .waitForFunction(() => document.fullscreenElement === null, null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (!salio) {
      await page
        .evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null))
        .catch(() => {});
      await page
        .waitForFunction(() => document.fullscreenElement === null, null, { timeout: 3000 })
        .catch(() => failures.push('fullscreen-sin-salir'));
    }
  } else if (!/pantalla completa/i.test(fullscreen.toast)) {
    failures.push(`fullscreen-sin-aviso=${JSON.stringify(fullscreen)}`);
  }

  /* ── 6. Ventana flotante (PiP) ── */
  await page.click('#btnStrobeFloat');
  await page.waitForFunction(
    () => {
      const info = window.__CORTEX__.strobe.getFloatingInfo();
      const panel = document.getElementById('strobePanel');
      const enPagina = Boolean(panel);
      return info.open === true || (enPagina && panel.dataset.strobePresentation === 'mini');
    },
    null,
    { timeout: 8000 },
  ).catch(() => failures.push('ventana-flotante-no-resolvio'));

  const floating = await page.evaluate(() => {
    const info = window.__CORTEX__.strobe.getFloatingInfo();
    const placeholder = document.getElementById('strobePipPlaceholder');
    return {
      ...info,
      panelEnPagina: Boolean(document.getElementById('strobePanel')),
      placeholderVisible: placeholder ? placeholder.hidden === false : null,
      presentation: document.getElementById('strobePanel')?.dataset.strobePresentation || 'missing',
      toast: document.getElementById('toast')?.textContent || '',
    };
  });

  if (floating.open) {
    if (!floating.placeholderVisible && floating.mode === 'document') {
      failures.push('ventana-abierta-sin-placeholder');
    }
    if (floating.mode === 'document') {
      /* El panel se muda a la ventana flotante: no puede seguir en la página. */
      if (floating.panelEnPagina) failures.push('ventana-abierta-pero-el-panel-sigue-en-la-pagina');
    } else {
      /* Ruta de vídeo: el panel se queda y es un canvas dedicado el que viaja. */
      const video = await page.evaluate(() => ({
        canvas: Boolean(document.getElementById('strobePipCanvas')),
        video: Boolean(document.getElementById('strobePipVideo')),
        pipElement: document.pictureInPictureElement?.id || null,
      }));
      if (!video.canvas || !video.video || video.pipElement !== 'strobePipVideo') {
        failures.push(`pip-de-video-incompleto=${JSON.stringify(video)}`);
      }
    }
    await page.evaluate(() => window.__CORTEX__.strobe.toggleStrobeFloating());
    await page.waitForTimeout(300);
    const devuelto = await page.evaluate(() => ({
      info: window.__CORTEX__.strobe.getFloatingInfo(),
      panelEnPagina: Boolean(document.getElementById('strobePanel')),
      placeholderVisible: document.getElementById('strobePipPlaceholder')?.hidden === false,
      pipElement: document.pictureInPictureElement?.id || null,
    }));
    if (devuelto.info.open) failures.push('la-ventana-no-se-cerro');
    if (!devuelto.panelEnPagina) failures.push('el-panel-no-volvio-al-documento');
    if (devuelto.placeholderVisible) failures.push('placeholder-visible-sin-ventana');
    if (devuelto.pipElement) failures.push(`pip-sigue-activo=${devuelto.pipElement}`);
  } else {
    if (floating.presentation !== 'mini') failures.push(`sin-pip-no-hay-mini=${JSON.stringify(floating)}`);
    if (!/ventana flotante no disponible/i.test(floating.toast)) {
      failures.push(`sin-pip-sin-aviso=${floating.toast}`);
    }
  }
  await page.evaluate(() => {
    if (window.__CORTEX__.session.state.strobe.presentation === 'mini') {
      window.__CORTEX__.strobe.toggleStrobeMini();
    }
  });

  /* ── 7. Pestaña oculta: nada de flash congelado encendido ── */
  await page.evaluate(() => window.__CORTEX__.strobe.setStrobeCustomHz(4));
  await page.waitForTimeout(60);
  const otra = await context.newPage();
  await otra.goto('about:blank');
  await otra.bringToFront();
  await page.waitForTimeout(400);
  const oculta = await page.evaluate(() => ({ hidden: document.hidden }));
  const pixelOculta = await centroDelFlash(page);
  await page.bringToFront();
  await otra.close();
  if (!oculta.hidden) {
    skipped.push('pestaña-oculta-no-montable: el Chromium headless no oculta la pestaña al traer otra al frente, así que el flash congelado quedó sin comprobar');
  } else if (pixelOculta && pixelOculta.r > 80) {
    failures.push(`flash-congelado-encendido=${JSON.stringify(pixelOculta)}`);
  }

  /* ── 8. Espacio con el foco en un botón activa ESE botón ── */
  await page.evaluate(() => window.__CORTEX__.strobe.setStrobeActive(false));
  await page.focus('#btnStrobePlay');
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  const espacio = await page.evaluate(() => ({
    strobeActive: Boolean(window.__CORTEX__.session.state.strobe.active),
    playing: Boolean(window.__CORTEX__.session.state.playing),
  }));
  if (!espacio.strobeActive) failures.push('espacio-no-activa-el-boton-con-foco');
  if (espacio.playing) failures.push('espacio-siguiendo-secuestrado-por-el-transporte');

  await page.evaluate(() => window.__CORTEX__.strobe.setStrobeActive(false));
  await page.screenshot({ path: screenshotFile, fullPage: true });

  if (capture.combined().length) failures.push(`errores=${capture.combined().join(' | ')}`);

  const report = {
    route: '/',
    initial,
    flash: { muestras, encendidos: rojos, apagados },
    afterPlay,
    sync,
    custom,
    mini,
    fullscreen,
    floating,
    hiddenTab: { ...oculta, pixel: pixelOculta },
    spaceKey: espacio,
    errors: capture.combined(),
    skipped,
    failures,
  };
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
