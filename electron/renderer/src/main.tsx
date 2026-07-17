// src/main.tsx — React 18 entry point (ThemeProvider + ErrorBoundary + MotionConfig)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { App } from './App';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from './components/error-boundary';
import './styles.css';

// 全局错误显示 — 任何未捕获的错误都直接显示在页面上 (黑屏调试用)
function showFatal(msg: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `<div style="position:fixed;inset:0;background:#1a1a1f;color:#ef4444;padding:32px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;overflow:auto;z-index:99999">${msg.replace(/</g, '&lt;')}</div>`;
}
window.addEventListener('error', (e) => {
  showFatal(`[Uncaught Error]\n${e.message}\n\n${e.error?.stack || ''}`);
});
window.addEventListener('unhandledrejection', (e) => {
  showFatal(`[Unhandled Rejection]\n${e.reason?.message || e.reason}\n\n${e.reason?.stack || ''}`);
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);