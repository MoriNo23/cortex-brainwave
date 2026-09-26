/* Sintaxis del JavaScript inline de cada HTML, validada con `node --check`.
   No ejecuta el código de la app: solo lo parsea. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { extractInlineJs } = require('../lib/extract-inline-js.cjs');
const { pass, fail } = require('../lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const OBJETIVOS = ['cortex.html', 'cortex.spec.html'];
const ID = 'inline-syntax';

function comprobarBloque(nombre, indice, codigo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-light-'));
  const destino = path.join(dir, 'bloque-' + String(indice) + '.mjs');
  try {
    fs.writeFileSync(destino, codigo);
    execFileSync(process.execPath, ['--check', destino], { stdio: ['ignore', 'ignore', 'pipe'] });
    return null;
  } catch (e) {
    // La ruta temporal solo estorba: se sustituye por el nombre real y el bloque.
    const salida = (e && e.stderr ? e.stderr.toString() : String(e))
      .split('\n')
      .map((l) => l.split(destino).join(nombre + ' (bloque ' + String(indice) + ')'))
      .filter((l) => l.trim() && !/^\s*\^/.test(l) && !/^\s*at /.test(l))
      .slice(0, 3)
      .join(' | ');
    return salida || nombre + ' bloque ' + String(indice) + ': error de sintaxis';
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function comprobar() {
  const errores = [];
  let total = 0;

  for (const nombre of OBJETIVOS) {
    const archivo = path.join(RAIZ, nombre);
    if (!fs.existsSync(archivo)) {
      errores.push(nombre + ': no existe');
      continue;
    }
    const { bloques } = extractInlineJs(archivo);
    if (bloques.length === 0) {
      errores.push(nombre + ': no tiene bloques <script> inline que validar');
      continue;
    }
    bloques.forEach((codigo, i) => {
      total++;
      const err = comprobarBloque(nombre, i, codigo);
      if (err) errores.push(err);
    });
  }

  if (errores.length) return fail(ID, errores.join(' || '));
  return pass(ID, total + ' bloques inline parsean (' + OBJETIVOS.join(', ') + ')');
}

module.exports = { ID, comprobar, OBJETIVOS };
