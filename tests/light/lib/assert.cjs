/* Contrato de resultado compartido por todos los chequeos del nivel ligero.
   CommonJS como el resto de tests/: un chequeo .cjs no puede require() de un .mjs. */

function pass(id, detalle) {
  return { id, ok: true, detalle: detalle == null ? '' : String(detalle) };
}

function fail(id, detalle) {
  return { id, ok: false, detalle: detalle == null ? '' : String(detalle) };
}

/* Normaliza un resultado suelto al contrato, por si un chequeo devuelve campos extra. */
function toResult(id, valor) {
  if (valor && typeof valor === 'object' && 'ok' in valor) {
    return {
      id: id,
      ok: Boolean(valor.ok),
      detalle: valor.detalle == null ? '' : String(valor.detalle),
    };
  }
  return valor ? pass(id, valor) : fail(id, '');
}

/* Serializa sin claves undefined/null y con claves ordenadas, para que el
   reporte sea estable entre corridas y comparable con git. */
function serialize(valor) {
  if (Array.isArray(valor)) return valor.map(serialize);
  if (valor && typeof valor === 'object') {
    const salida = {};
    for (const clave of Object.keys(valor).sort()) {
      if (valor[clave] === undefined || valor[clave] === null) continue;
      salida[clave] = serialize(valor[clave]);
    }
    return salida;
  }
  return valor;
}

module.exports = { pass, fail, toResult, serialize };
