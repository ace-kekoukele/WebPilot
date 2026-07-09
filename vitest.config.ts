import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['electron/renderer/src/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'electron/renderer/src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'test/**', 'electron/**/node_modules/**'],
    setupFiles: ['./electron/renderer/src/test/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'electron/renderer/src'),
    },
  },
});