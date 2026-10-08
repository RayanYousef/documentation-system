import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { name: 'editor', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
});
