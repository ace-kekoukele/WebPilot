// src/main.tsx — React 18 entry point (ThemeProvider + ErrorBoundary + MotionConfig)
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { App } from './App';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from './components/error-boundary';
import './styles.css';

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