#!/usr/bin/env node
/* El Worker de la ventana flotante, ejecutado de verdad.

   Node puro: sin navegador y sin servidor. Se construye el fuente exacto que
   recibirá el navegador (`buildStrobeWorkerSource`) y se ejecuta en un contexto
   `vm` con un `self` y un lienzo simulados. Cubre lo que ningún job con
   navegador puede cubrir bien (un runner headless no abre una ventana PiP):

     1. el fuente del Worker es válido y arranca (no es una cadena muerta);
     2. la intensidad que pinta coincide con `strobeIntensityWindow`, la misma
        función contrastada contra la referencia de Python;
     3. pinta la misma secuencia de operaciones que `paintStrobeSurface` en el
        hilo principal — el Worker transcribe esa lógica, y esto es lo que
        garantiza que la transcripción no diverja;
     4. el temporizador del Worker pinta tras `start` y se libera con `stop`;
     5. con `esbuild` disponible, todo lo anterior se repite sobre el fuente
        **minificado**: el bundler renombra referencias internas y ya se ha
        colado un `ReferenceError` por ahí. Sin dependencias instaladas el paso
        se omite y lo dice. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const RAIZ = path.resolve(__dirname, '..');
const REPORTE = path.join(RAIZ, 'artifacts', 'strobe-worker.json');
const FIXTURES = path.join(RAIZ, 'tools', 'math-reference', 'fixtures.json');

const IDLE_R = 17;
const PULSE_R = 246;
const T0 = 100000;

function crearLienzoSimulado(registro) {
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
    clearRect(...args) {
      registro.push({ op: 'clearRect', args });
    },
    fillRect(...args) {
      registro.push({ op: 'fillRect', fillStyle: ctx.fillStyle, shadowBlur: ctx.shadowBlur, args });
    },
    strokeRect(...args) {
      registro.push({ op: 'strokeRect', strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth, args });
    },
    createRadialGradient(...args) {
      registro.push({ op: 'gradient', args });
      return { addColorStop() {} };
    },
  };
  return { width: 512, height: 512, getContext: () => ctx };
}

function intensidadPintada(registro) {
  const rellenos = registro.filter((entrada) => entrada.op === 'fillRect');
  /* 0 = fondo, 1 = halo radial, 2 = núcleo del flash */
  const nucleo = rellenos[2];
  if (!nucleo) return null;
  const [r] = String(nucleo.fillStyle).match(/\d+/g).map(Number);
  return (r - IDLE_R) / (PULSE_R - IDLE_R);
}

/* Firma del fotograma: operaciones, estilos Y geometría. Sin los argumentos una
   transcripción que dibujara el cuadrado en otro sitio o de otro tamaño daría
   verde, que es justo el fallo que esta firma tiene que cazar. */
function firma(registro) {
  const redondear = (numero) => Math.round(Number(numero) * 100) / 100;
  return registro
    .filter((entrada) => entrada.op !== 'gradient')
    .map((entrada) => [
      entrada.op,
      entrada.fillStyle || '',
      entrada.strokeStyle || '',
      entrada.lineWidth || '',
      (entrada.args || []).map(redondear).join(','),
    ].join(':'))
    .join('|');
}

/* Ejecuta un fuente de Worker contra el arnés y lo contrasta con los módulos. */
function ejecutarWorker(fuente, { etiqueta, modulos, fixtures, conTemporizador = false }) {
  const { strobeFrequencyFromState, strobeIntensityWindow } = modulos.math;
  const { STROBE_PALETTE, paintStrobeSurface } = modulos.paint;

  let relojWorker = 0;
  const intervalos = [];
  let intervalosActivos = 0;
  const mensajes = [];
  const registro = [];
  const selfObj = {
    performance: { now: () => relojWorker },
    setInterval: (fn) => {
      intervalos.push(fn);
      intervalosActivos += 1;
      return intervalos.length;
    },
    clearInterval: () => {
      intervalosActivos = Math.max(0, intervalosActivos - 1);
    },
    postMessage: (mensaje) => mensajes.push(mensaje),
  };

  const contexto = vm.createContext({ self: selfObj, console });
  vm.runInContext(fuente, contexto, { filename: `cortex-strobe-worker-${etiqueta}.js` });

  const fallos = [];
  if (typeof selfObj.onmessage !== 'function') {
    return { etiqueta, fallos: [{ motivo: 'el Worker no registró self.onmessage' }], muestras: 0 };
  }

  const lienzo = crearLienzoSimulado(registro);
  selfObj.onmessage({
    data: { type: 'init', canvas: lienzo, width: 512, height: 512, hz: 10, active: false, mainNow: T0 },
  });

  function muestrear(hz, active, mainNowMs) {
    registro.length = 0;
    relojWorker = mainNowMs - T0;
    selfObj.onmessage({ data: { type: 'params', hz, active } });
    return { intensidad: intensidadPintada(registro), firma: firma(registro) };
  }

  let totalMuestras = 0;
  for (const caso of fixtures.strobeEnvelopeCases) {
    const hz = strobeFrequencyFromState(
      { mode: caso.mode, customHz: caso.customHz },
      { brainwave: caso.brainwave },
    );
    for (const timestampMs of caso.timestampsMs) {
      totalMuestras += 1;
      const esperado = strobeIntensityWindow(hz, T0 + timestampMs).intensity;
      const obtenido = muestrear(hz, true, T0 + timestampMs);

      const registroDirecto = [];
      const ctxDirecto = crearLienzoSimulado(registroDirecto).getContext();
      paintStrobeSurface(ctxDirecto, 512, 512, esperado, STROBE_PALETTE);

      if (obtenido.intensidad === null) {
        fallos.push({ caso: caso.mode, hz, timestampMs, motivo: 'el Worker no pintó el núcleo' });
      } else if (Math.abs(obtenido.intensidad - esperado) > 0.01) {
        fallos.push({
          caso: caso.mode,
          hz,
          timestampMs,
          motivo: 'intensidad distinta',
          esperado,
          obtenido: obtenido.intensidad,
        });
      }
      if (obtenido.firma !== firma(registroDirecto)) {
        fallos.push({ caso: caso.mode, hz, timestampMs, motivo: 'pintado distinto al del hilo principal' });
      }
    }
  }

  const apagado = muestrear(10, false, T0 + 25);
  if (apagado.intensidad === null || Math.abs(apagado.intensidad) > 0.01) {
    fallos.push({ caso: 'inactive', motivo: 'el Worker pinta con active=false', obtenido: apagado.intensidad });
  }

  let temporizador = null;
  if (conTemporizador) {
    selfObj.onmessage({ data: { type: 'start', intervalMs: 16 } });
    const activo = intervalosActivos === 1 && intervalos.length === 1;
    registro.length = 0;
    relojWorker = 40;
    if (intervalos[0]) intervalos[0]();
    const pinta = registro.filter((entrada) => entrada.op === 'fillRect').length === 3;
    selfObj.onmessage({ data: { type: 'frames' } });
    selfObj.onmessage({ data: { type: 'stop' } });
    if (!activo) fallos.push({ caso: 'start', motivo: 'start no registró exactamente un intervalo' });
    if (!pinta) fallos.push({ caso: 'timer', motivo: 'el intervalo no pintó un fotograma completo' });
    if (intervalosActivos !== 0) fallos.push({ caso: 'stop', motivo: 'stop no liberó el intervalo' });
    temporizador = { activo, pinta, liberado: intervalosActivos === 0 };
  }

  return { etiqueta, fallos, muestras: totalMuestras, temporizador, mensajes, chars: fuente.length };
}

async function fuenteMinificada() {
  let esbuild;
  try {
    esbuild = require(require.resolve('esbuild', { paths: [RAIZ] }));
  } catch (error) {
    return { disponible: false, motivo: 'esbuild no instalado (sin npm install)' };
  }
  const salida = path.join(os.tmpdir(), `cortex-strobe-window-${process.pid}.mjs`);
  esbuild.buildSync({
    entryPoints: [path.join(RAIZ, 'src', 'lib', 'cortex-strobe-window.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: salida,
    logLevel: 'silent',
  });
  const modulo = await import(pathToFileURL(salida).href);
  const fuente = modulo.buildStrobeWorkerSource();
  fs.rmSync(salida, { force: true });
  return { disponible: true, fuente };
}

async function main() {
  const { buildStrobeWorkerSource } = await import('../src/lib/cortex-strobe-window.js');
  const math = await import('../src/lib/core-math.js');
  const paint = await import('../src/lib/cortex-strobe-paint.js');
  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
  const modulos = { math, paint };

  const fuenteDirecta = buildStrobeWorkerSource();
  const directo = ejecutarWorker(fuenteDirecta, {
    etiqueta: 'fuente',
    modulos,
    fixtures,
    conTemporizador: true,
  });

  const minificado = await fuenteMinificada();
  let sobreMinificado = null;
  if (minificado.disponible) {
    sobreMinificado = ejecutarWorker(minificado.fuente, { etiqueta: 'minificado', modulos, fixtures });
  }

  const fallos = [...directo.fallos, ...(sobreMinificado ? sobreMinificado.fallos : [])];

  const reporte = {
    nivel: 'worker-estrobo',
    fuente: { chars: directo.chars, muestras: directo.muestras, temporizador: directo.temporizador },
    minificado: minificado.disponible
      ? { disponible: true, chars: sobreMinificado.chars, muestras: sobreMinificado.muestras }
      : { disponible: false, motivo: minificado.motivo },
    fallos,
  };

  fs.mkdirSync(path.dirname(REPORTE), { recursive: true });
  fs.writeFileSync(REPORTE, JSON.stringify(reporte, null, 2) + '\n');

  if (fallos.length) {
    console.log(`FAIL  worker-estrobo — ${fallos.length} fallos`);
    fallos.slice(0, 10).forEach((fallo) => console.log('  ' + JSON.stringify(fallo)));
    console.log('reporte en artifacts/strobe-worker.json');
    process.exit(1);
  }

  console.log(`PASS  worker-estrobo — ${directo.muestras} muestras contra la referencia y el pintado principal`);
  console.log(minificado.disponible
    ? `PASS  worker-estrobo minificado — ${sobreMinificado.muestras} muestras sobre el bundle con esbuild`
    : `OMITIDO worker-estrobo minificado — ${minificado.motivo}`);
  console.log('reporte en artifacts/strobe-worker.json');
  process.exit(0);
}

main().catch((error) => {
  console.error('FAIL  worker-estrobo — ' + (error && error.stack ? error.stack : String(error)));
  process.exit(2);
});
