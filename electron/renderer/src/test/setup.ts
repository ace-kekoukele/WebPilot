// src/test/setup.ts — vitest 全局 setup (jest-dom + 自定义清理)
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});