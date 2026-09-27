/* Todo id que el script inline pide debe existir en el markup.
   Cubre getElementById('x') y $('#x'); no interpreta selectores CSS completos
   porque ahí los falsos positivos erosionan la señal (design.md, D4). */
const fs = require('fs');
const path = require('path');
const { extractInlineJs } = require('../lib/extract-inline-js.cjs');
const { pass, fail } = require('../lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const OBJETIVO = 'cortex.html';
const ID = 'dom-references';

const PATRONES = [
  /getElementById\s*\(\s*['"]([^'"]+)['"]/g,
  /\$\s*\(\s*['"]#([A-Za-z0-9_-]+)['"]/g,
];

function comprobar() {
  const archivo = path.join(RAIZ, OBJETIVO);
  if (!fs.existsSync(archivo)) return fail(ID, OBJETIVO + ': no existe');

  const html = fs.readFileSync(archivo, 'utf8');
  const declarados = new Set();
  for (const m of html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)) declarados.add(m[1]);

  const { bloques } = extractInlineJs(archivo);
  const codigo = bloques.join('\n');

  const usados = new Set();
  for (const regex of PATRONES) {
    regex.lastIndex = 0;
    for (const m of codigo.matchAll(regex)) usados.add(m[1]);
  }

  if (usados.size === 0) {
    return fail(ID, 'no se encontró ningún acceso al DOM: el chequeo está roto, no la app');
  }

  const huerfanos = [...usados].filter((i) => !declarados.has(i)).sort();
  if (huerfanos.length) {
    return fail(ID, OBJETIVO + ': ' + huerfanos.length + ' id(s) usados y no declarados → ' + huerfanos.join(', '));
  }
  return pass(
    ID,
    OBJETIVO + ': ' + usados.size + ' ids usados, ' + declarados.size + ' declarados, 0 huérfanos'
  );
}

module.exports = { ID, comprobar, OBJETIVO };
