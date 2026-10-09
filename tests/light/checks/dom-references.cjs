/* Todo id que el script pide debe existir en el markup de src/ o declararse en el propio JS.
   Cubre getElementById('x') y $('#x'); no interpreta selectores CSS completos porque ahí
   los falsos positivos erosionan la señal. Los ids que el JS genera en cadenas de HTML
   (id="x", .id = 'x', setAttribute('id','x')) cuentan como declarados. */
const fs = require('fs');
const path = require('path');
const { pass, fail } = require('../lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const OBJETIVO = 'src';
const ID = 'dom-references';
const EXTENSIONES = ['.astro', '.js'];

const USOS = [
  /getElementById\s*\(\s*['"]([^'"]+)['"]/g,
  /\$\s*\(\s*['"]#([A-Za-z0-9_-]+)['"]/g,
];
const DECLARACIONES = [
  /\bid\s*=\s*\\?["']([^"'\\$]+)/g,
  /\.id\s*=\s*['"`]([^'"`$]+)/g,
  /setAttribute\s*\(\s*['"]id['"]\s*,\s*['"]([^'"]+)['"]/g,
];

function listar(dir, salida = []) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) listar(ruta, salida);
    else if (EXTENSIONES.some((ext) => entrada.name.endsWith(ext))) salida.push(ruta);
  }
  return salida;
}

function recolectar(texto, patrones, destino) {
  for (const regex of patrones) {
    regex.lastIndex = 0;
    for (const m of texto.matchAll(regex)) destino.add(m[1]);
  }
}

function comprobar() {
  const dir = path.join(RAIZ, OBJETIVO);
  if (!fs.existsSync(dir)) return fail(ID, OBJETIVO + ': no existe');

  const usados = new Set();
  const declarados = new Set();
  for (const archivo of listar(dir)) {
    const texto = fs.readFileSync(archivo, 'utf8');
    recolectar(texto, USOS, usados);
    recolectar(texto, DECLARACIONES, declarados);
  }

  if (usados.size === 0) {
    return fail(ID, 'no se encontró ningún acceso al DOM: el chequeo está roto, no la app');
  }

  const huerfanos = [...usados].filter((id) => !declarados.has(id)).sort();
  if (huerfanos.length) {
    return fail(ID, OBJETIVO + ': ' + huerfanos.length + ' id(s) usados y no declarados → ' + huerfanos.join(', '));
  }
  return pass(
    ID,
    OBJETIVO + ': ' + usados.size + ' ids usados, ' + declarados.size + ' declarados, 0 huérfanos'
  );
}

module.exports = { ID, comprobar, OBJETIVO };
