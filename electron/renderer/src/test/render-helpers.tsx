// src/test/render-helpers.tsx — 通用 render 工具 (含所有必要 Provider)
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MotionConfig } from 'framer-motion';

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Wrapper, ...options });
}