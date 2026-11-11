import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In development everything goes through the dev server so the browser only
 * ever talks to localhost:5173 and CORS never enters the picture. A production
 * build talks to `VITE_API_BASE_URL` (or the same origin, if the API is served
 * behind the same host).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    // Solomon Islands traffic is mostly mid-range Android Chrome; es2019 keeps
    // the bundle parseable on older devices without shipping the legacy build.
    target: 'es2019',
    sourcemap: false,
  },
});
