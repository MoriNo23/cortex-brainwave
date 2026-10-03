import { defineConfig } from 'astro/config';

export default defineConfig({
  server: {
    host: true,
    port: 4173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  vite: {
    server: {
      allowedHosts: ['.e2b.app'],
    },
    preview: {
      allowedHosts: ['.e2b.app'],
    },
  },
  output: 'static',
});
