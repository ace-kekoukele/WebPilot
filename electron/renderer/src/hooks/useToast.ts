// src/hooks/useToast.ts — Toast 通知 Hook (封装 pushToast)
import { useCallback } from 'react';
import { pushToast } from '../components/Toast';

export type ToastKind = 'success' | 'error' | 'warn' | 'info' | 'loading';

export interface ToastOptions {
  kind?: ToastKind;
  title: string;
  description?: string;
  duration?: number;
  actions?: Array<{ label: string; onClick: () => void }>;
}

export function useToast() {
  const toast = useCallback((opts: ToastOptions) => {
    pushToast(opts as any);
  }, []);

  const success = useCallback((title: string, description?: string) => {
    pushToast({ kind: 'success', title, description, duration: 3000 });
  }, []);

  const error = useCallback((title: string, description?: string) => {
    pushToast({ kind: 'error', title, description, duration: 5000 });
  }, []);

  const warn = useCallback((title: string, description?: string) => {
    pushToast({ kind: 'warn', title, description, duration: 4000 });
  }, []);

  const info = useCallback((title: string, description?: string) => {
    pushToast({ kind: 'info', title, description, duration: 3000 });
  }, []);

  const loading = useCallback((title: string) => {
    pushToast({ kind: 'loading', title, duration: 0 });
  }, []);

  return { toast, success, error, warn, info, loading };
}
