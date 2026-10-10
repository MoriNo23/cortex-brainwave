#!/usr/bin/env node
/* Chequeo estático del build: el HTML generado referencia JS/CSS existentes.
   Sustituye al smoke de navegador del shell Astro (retirado con el e2e):
   recorre los <script src> y <link href> de dist/ y comprueba que cada ruta
   exista en el build. No renderiza nada: es un chequeo de rutas. */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const DIST = path.join(RAIZ, 'dist');

function comprobar() {
  if (!fs.existsSync(DIST)) {
    return { id: 'dist-references', ok: false, detalle: 'dist/ no existe: el build no corrió' };
  }
  const faltantes = [];
  const htmlFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) htmlFiles.push(full);
    }
  };
  walk(DIST);
  if (htmlFiles.length === 0) {
    return { id: 'dist-references', ok: false, detalle: 'dist/ no contiene HTML' };
  }
  const refs = /(?:src|href)="([^"]+)"[^>]*>/g;
  let total = 0;
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = refs.exec(html)) !== null) {
      const ref = m[1];
      // Solo rutas locales del build: absolutas del sitio bajo PAGES_BASE o relativas.
      if (!ref || ref.startsWith('http') || ref.startsWith('//') || ref.startsWith('data:') || ref.startsWith('#')) continue;
      if (!/\.(js|css)(\?|$)/.test(ref)) continue;
      total += 1;
      let local = ref;
      const baseMatch = /^\/cortex-brainwave\/(.*)$/.exec(ref);
      if (baseMatch) local = baseMatch[1];
      const resolved = path.resolve(DIST, local.replace(/^\//, ''));
      if (!fs.existsSync(resolved)) faltantes.push(`${path.relative(RAIZ, file)} → ${ref}`);
    }
  }
  if (total === 0) {
    return { id: 'dist-references', ok: false, detalle: 'el HTML del build no referencia ningún JS/CSS' };
  }
  return {
    id: 'dist-references',
    ok: faltantes.length === 0,
    detalle: faltantes.length === 0
      ? `${total} referencias JS/CSS de dist/ existen`
      : `faltan ${faltantes.length}: ${faltantes.slice(0, 5).join(' ; ')}`,
  };
}

module.exports = { comprobar };
if (require.main === module) {
  const r = comprobar();
  console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.id + (r.detalle ? '  — ' + r.detalle : ''));
  process.exit(r.ok ? 0 : 1);
}
