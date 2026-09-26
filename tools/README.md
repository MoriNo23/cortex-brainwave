# Herramientas de auditoría aisladas

Estas herramientas son de desarrollo/auditoría; ninguna se importa desde `cortex.html` ni se incluye como dependencia de producción.

## Versiones y comandos

- Difftastic `0.70.0`: binario reproducible en `tools/difftastic/difft`, descargado del release oficial para `x86_64-unknown-linux-gnu`.
- ast-grep CLI `0.45.3`: instalación/ejecución efímera y versionada con `npx --yes --package @ast-grep/cli@0.45.3 ast-grep`.

```bash
DFT_UNSTABLE=yes DFT_COLOR=never \
  tools/difftastic/difft --display json \
  artifacts/audit/cortex-transcript-baseline.html cortex.html \
  > artifacts/audit/cortex-diff.json

python3 - <<'PY'
import re
from pathlib import Path
src = Path('cortex.html').read_text()
blocks = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', src, re.S | re.I)
Path('artifacts/audit/cortex-inline.js').write_text('\n\n'.join(blocks))
PY

npx --yes --package @ast-grep/cli@0.45.3 ast-grep run \
  -p 'state.stereo = $VALUE' -l js artifacts/audit/cortex-inline.js --json \
  > artifacts/audit/ast-grep-stereo.json
```

Los JSON bajo `artifacts/audit/` son la evidencia generada para esta revisión. La extracción de JavaScript inline es intencional: el patrón de HTML embebido no se evaluó como si fuera un archivo JavaScript separado.
