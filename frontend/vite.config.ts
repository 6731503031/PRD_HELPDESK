import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Builds the React UI into ../public, which the Worker serves via Workers Static Assets.
// Dev: `npm run dev:web` (port 5173) proxies /api to `wrangler dev` (port 8787).
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL('../public', import.meta.url)), emptyOutDir: true },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8787' } },
});
