/* Extrae los bloques <script> inline de un HTML sin dependencias externas.
   Mismo regex que documenta tools/README.md para la auditoría con difftastic. */
const fs = require('fs');

const SCRIPT_BLOCK = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;

function extractInlineJs(file) {
  const src = fs.readFileSync(file, 'utf8');
  const bloques = [];
  let m;
  SCRIPT_BLOCK.lastIndex = 0;
  while ((m = SCRIPT_BLOCK.exec(src)) !== null) {
    bloques.push(m[1]);
  }
  return { file, bloques };
}

module.exports = { extractInlineJs, SCRIPT_BLOCK };
