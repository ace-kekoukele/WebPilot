// vite.config.js — React + TypeScript bundler
// 输出到 electron/renderer/dist/ — daemon 优先 serve 这个, 没有则 fallback 到 daemon/static/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'electron/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'electron/renderer/dist'),
    emptyOutDir: true,
    target: 'chrome120',   // 配合 Electron / Chrome 用户的现代浏览器
    rollupOptions: {
      output: {
        // 把所有 JS / CSS 都打成单文件 (加载更快)
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发时直接代理到 daemon (v4.0 端口 9224)
      '/api':   { target: 'http://127.0.0.1:9224', changeOrigin: true },
      '/mcp':   { target: 'http://127.0.0.1:9224', changeOrigin: true },
      '/.well-known': { target: 'http://127.0.0.1:9224', changeOrigin: true },
    },
  },
});
