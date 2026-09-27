/* Forma del arreglo TESTS del runner in-page: cada entrada debe declarar
   group, name y fn. Escaneo de caracteres con estados de cadena y comentario,
   porque un simple split por comas rompe con las flechas y los templates. */
const fs = require('fs');
const path = require('path');
const { pass, fail } = require('../lib/assert.cjs');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const OBJETIVO = 'cortex.spec.html';
const ID = 'scenario-runner-shape';
const CAMPOS = ['group', 'name', 'fn'];

/* Devuelve los índices de las entradas de primer nivel del arreglo que empieza
   en `inicio`. Un escáner, no un regex: cuenta profundidad respetando
   cadenas, plantillas y comentarios. */
function escanearEntradas(src, inicio) {
  const entradas = [];
  let profundidad = 0;
  let inicioEntrada = -1;
  let i = inicio;

  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];

    if (c === '/' && d === '/') {
      i = src.indexOf('\n', i);
      if (i === -1) break;
      continue;
    }
    if (c === '/' && d === '*') {
      const fin = src.indexOf('*/', i + 2);
      if (fin === -1) break;
      i = fin + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === c) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '{' || c === '[' || c === '(') {
      if (c === '{' && profundidad === 1) inicioEntrada = i;
      profundidad++;
      i++;
      continue;
    }
    if (c === '}' || c === ']' || c === ')') {
      profundidad--;
      if (c === '}' && profundidad === 1 && inicioEntrada !== -1) {
        entradas.push({ inicio: inicioEntrada, fin: i });
        inicioEntrada = -1;
      }
      if (profundidad === 0) return entradas;
      i++;
      continue;
    }
    i++;
  }
  return entradas;
}

function comprobar() {
  const archivo = path.join(RAIZ, OBJETIVO);
  if (!fs.existsSync(archivo)) return fail(ID, OBJETIVO + ': no existe');

  const src = fs.readFileSync(archivo, 'utf8');
  const declaracion = src.match(/\b(?:const|let|var)\s+TESTS\s*=\s*\[/);
  if (!declaracion) return fail(ID, OBJETIVO + ': no se encontró la declaración del arreglo TESTS');

  const corchete = src.indexOf('[', declaracion.index);
  const entradas = escanearEntradas(src, corchete);

  if (entradas.length === 0) {
    return fail(ID, OBJETIVO + ': TESTS no tiene entradas — el escaneo está roto, no el runner');
  }

  /* Contraste con un conteo independiente. Si una llave falta, el escaneo por
     profundidad se traga el resto del arreglo y devuelve una sola entrada
     gigante; sin este cruce, eso pasa por un verde (design.md, riesgos). */
  const esperados = (src.slice(corchete).match(/\{\s*group\s*:/g) || []).length;
  if (entradas.length !== esperados) {
    return fail(
      ID,
      OBJETIVO + ': el escaneo encontró ' + entradas.length + ' entradas pero hay ' + esperados +
        ' declaraciones `group:` — la estructura del arreglo no se puede analizar con confianza'
    );
  }

  const rotas = [];
  entradas.forEach((e, idx) => {
    const texto = src.slice(e.inicio, e.fin + 1);
    const faltan = CAMPOS.filter((c) => !new RegExp('(^|[{,\\s])' + c + '\\s*:').test(texto));
    if (faltan.length) rotas.push('entrada ' + (idx + 1) + ' sin ' + faltan.join('/'));
  });

  if (rotas.length) {
    return fail(
      ID,
      OBJETIVO + ': ' + rotas.length + ' de ' + entradas.length + ' entradas mal formadas → ' +
        rotas.slice(0, 5).join(' || ') + (rotas.length > 5 ? ' || …' : '')
    );
  }
  return pass(ID, OBJETIVO + ': ' + entradas.length + ' entradas con group, name y fn');
}

module.exports = { ID, comprobar, escanearEntradas, OBJETIVO };
