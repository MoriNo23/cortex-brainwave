# Tasks

> ## Cómo se verifica este cambio
>
> Es un cambio de pipeline, no de app: nada se ejecuta en la máquina de trabajo.
> El workflow de Pages se verifica donde corre —la pestaña Actions de GitHub—
> y el sitio publicado se verifica abriéndolo. La habilitación de Pages es una
> acción de settings en GitHub que ningún commit puede reemplazar.

## 1. Pipeline de publicación

- [x] 1.1 Crear `.github/workflows/pages.yml` con disparo `workflow_run` sobre el workflow `CI` en `main` filtrado por `conclusion == 'success'`, más `workflow_dispatch`, permisos mínimos (`contents: read`, `pages: write`, `id-token: write`) y `concurrency` con `cancel-in-progress`, y verificar tras el push que aparece en la pestaña Actions y que solo publica cuando CI completa.
- [x] 1.2 Preparar el sitio en el pipeline (copiar `cortex.html` como `site/index.html` con `.nojekyll` y desplegarlo con `upload-pages-artifact` + `deploy-pages`), y verificar que el repo no contiene un `index.html` duplicado: la copia vive solo en el artifact.
- [x] 1.3 Documentar en README la publicación (URL resultante, disparo tras CI verde, escape manual y el paso único de habilitación), y verificar que la sección vive junto a la tabla de jobs de CI.

## 2. Habilitación y verificación

- [x] 2.1 Habilitar Pages en el repo: Settings → Pages → Source: GitHub Actions. (Acción humana única en GitHub; hasta entonces el workflow falla visiblemente en vez de fingir éxito.)
- [x] 2.2 Tras un push con CI verde, leer en Actions la corrida de "Publicar la app en Pages" — despachándola a mano la primera vez si `workflow_run` no disparó — y verificar que despliega y reporta la URL del environment `github-pages`.
- [ ] 2.3 Verificación humana: abrir la URL publicada y comprobar que la app carga como la autónoma, que el audio arranca con el click en Iniciar y que los ajustes guardados son los del origen de Pages. (Requiere una mirada del usuario; sin auriculares obligatorios.)
