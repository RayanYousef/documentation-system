import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import platform from '../../platform.config.js';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `@/` is used only by the vendored shadcn / Plate UI files under src/richtext/plate (kept in upstream form).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  base: `${platform.baseUrl}editor/`,
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
