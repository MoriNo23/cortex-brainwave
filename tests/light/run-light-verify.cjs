#!/usr/bin/env node
/* Runner del nivel ligero de verificación.
   Node puro: sin navegador, sin dependencias, sin servidor y sin red.
   Cada chequeo es un módulo en checks/ que exporta `comprobar()`. */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { serialize } = require('./lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..');
const REPORTE = path.join(RAIZ, 'artifacts', 'light-verify.json');

/* Registro de chequeos. Todos leen archivos del repo: ninguno lanza un motor. */
const CHEQUOS = [
  { id: 'inline-syntax', ruta: 'checks/inline-syntax.cjs' },
  { id: 'self-contained', ruta: 'checks/self-contained.cjs' },
  { id: 'dom-references', ruta: 'checks/dom-references.cjs' },
  { id: 'scenario-runner-shape', ruta: 'checks/scenario-runner-shape.cjs' },
];

async function cargar(fn) {
  return pathToFileURL(path.join(__dirname, fn)).href;
}

async function main() {
  if (CHEQUOS.length === 0) {
    console.error('verify:light: no hay chequeos registrados.');
    console.error('Un reporte sin ningún chequeo no es un verde, así que no se escribe nada.');
    process.exit(2);
  }

  const chequeos = [];
  let fallos = 0;

  for (const c of CHEQUOS) {
    let r;
    try {
      const mod = await import(await cargar(c.ruta));
      r = serialize(mod.comprobar());
    } catch (e) {
      r = serialize({
        id: c.id,
        ok: false,
        detalle: 'el chequeo no se pudo ejecutar: ' + (e && e.message ? e.message : String(e)),
      });
    }
    chequeos.push(r);
    if (!r.ok) fallos++;
    console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.id + (r.detalle ? '  — ' + r.detalle : ''));
  }

  fs.mkdirSync(path.dirname(REPORTE), { recursive: true });
  const reporte = serialize({ nivel: 'ligero', total: chequeos.length, fallos, chequeos });
  fs.writeFileSync(REPORTE, JSON.stringify(reporte, null, 2) + '\n');

  console.log(
    (fallos ? 'FAIL' : 'PASS') + '  ' + String(fallos) + ' de ' + String(chequeos.length) +
    ' chequeos fallaron — reporte en artifacts/light-verify.json'
  );
  console.log('Nota: un verde aquí no dice nada sobre la suite con navegador; esa corre en CI.');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error('verify:light: fallo inesperado — ' + (e && e.stack ? e.stack : String(e)));
  process.exit(2);
});
