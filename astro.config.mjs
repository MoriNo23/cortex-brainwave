import { defineConfig } from 'astro/config';

export default defineConfig({
  server: {
    host: true,
    port: 4173,
    /* Ojo: Astro lee `server.allowedHosts` (nivel Astro, no `vite.server`) y lo
       impone tanto en `astro dev` como en `astro preview`, por encima de
       `vite.server.allowedHosts` y `vite.preview.allowedHosts`. Con la lista en
       el nivel de Vite el preview responde 403 a cualquier host que no sea
       localhost. Ver `astro/dist/core/preview/static-preview-server.js`. */
    allowedHosts: ['.e2b.app'],
  },
  preview: {
    host: true,
    port: 4173,
  },
  output: 'static',
  /* Pages sirve bajo /<repo>/; el workflow lo fija con PAGES_BASE. En local es '/'. */
  base: process.env.PAGES_BASE || '/',
});
