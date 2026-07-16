// vite.config.js — React + TypeScript + Tailwind v4 bundler
// 输出到 electron/renderer/dist/ — daemon 优先 serve 这个
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'electron/renderer'),
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'electron/renderer/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'electron/renderer/dist'),
    emptyOutDir: true,
    target: 'chrome120',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api':   { target: 'http://127.0.0.1:9224', changeOrigin: true },
      '/mcp':   { target: 'http://127.0.0.1:9224', changeOrigin: true },
      '/.well-known': { target: 'http://127.0.0.1:9224', changeOrigin: true },
    },
  },
});