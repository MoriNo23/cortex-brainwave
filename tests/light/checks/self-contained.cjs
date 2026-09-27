/* La app es un HTML autónomo: no debe cargar recursos ni llamar a un origen remoto. */
const fs = require('fs');
const path = require('path');
const { extractInlineJs } = require('../lib/extract-inline-js.cjs');
const { pass, fail } = require('../lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const OBJETIVOS = ['cortex.html', 'cortex.spec.html'];
const ID = 'self-contained';

/* Solo cuentan los orígenes remotos: rutas relativas o data:/blob: son locales. */
const REMOTO = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/* Patrones de etiqueta: se aplican al HTML completo. Un <script src> no es un
   bloque inline, así que se revisa el archivo sin recortar nada. */
const ETIQUETAS = [
  { etiqueta: 'script externo', regex: /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi },
  { etiqueta: 'link externo', regex: /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi },
];

/* Patrones de código: se aplican solo al JavaScript inline, para no confundir
   texto de la interfaz con una llamada de red. */
const CODIGO = [
  { etiqueta: 'fetch remoto', regex: /\bfetch\s*\(\s*["']([^"']+)["']/g, remoto: true },
  { etiqueta: 'import dinámico remoto', regex: /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g, remoto: true },
  { etiqueta: 'import estático', regex: /\bimport\s+[^;]*?\bfrom\s*["']([^"']+)["']/g, remoto: false },
  { etiqueta: 'XMLHttpRequest', regex: /\bnew\s+XMLHttpRequest\s*\(\s*\)/g, remoto: false },
];

function revisar(texto, patrones) {
  const out = [];
  for (const { etiqueta, regex, remoto } of patrones) {
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(texto)) !== null) {
      if (remoto) {
        if (REMOTO.test(m[1])) out.push(etiqueta + ' → ' + m[1]);
      } else {
        out.push(etiqueta);
      }
    }
  }
  return out;
}

function comprobar() {
  const hallazgos = [];

  for (const nombre of OBJETIVOS) {
    const archivo = path.join(RAIZ, nombre);
    if (!fs.existsSync(archivo)) {
      hallazgos.push(nombre + ': no existe');
      continue;
    }

    const html = fs.readFileSync(archivo, 'utf8');
    for (const h of revisar(html, ETIQUETAS)) hallazgos.push(nombre + ': ' + h);

    const { bloques } = extractInlineJs(archivo);
    for (const h of revisar(bloques.join('\n'), CODIGO)) hallazgos.push(nombre + ' (inline): ' + h);
  }

  if (hallazgos.length) {
    return fail(ID, 'la app dejó de ser autónoma — ' + hallazgos.join(' || '));
  }
  return pass(ID, 'sin scripts, links ni llamadas remotas en ' + OBJETIVOS.join(', '));
}

module.exports = { ID, comprobar, OBJETIVOS };
