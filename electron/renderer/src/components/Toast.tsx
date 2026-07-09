// src/components/Toast.tsx — Toast 通知层
import React, { useEffect, useState, useCallback } from 'react';

export interface Toast {
  id: number;
  kind: 'success' | 'warn' | 'error' | 'info' | 'action';
  title: string;
  description?: string;
  duration?: number;
  actions?: Array<{ label: string; onClick: () => void }>;
}

let _id = 0;
const listeners = new Set<(t: Toast) => void>();
const _toasts: Toast[] = [];

export function pushToast(t: Omit<Toast, 'id'>) {
  const toast: Toast = { id: ++_id, duration: 4000, ...t };
  _toasts.push(toast);
  listeners.forEach((l) => l());
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => dismissToast(toast.id), toast.duration);
  }
  return toast.id;
}
export function dismissToast(id: number) {
  const i = _toasts.findIndex((t) => t.id === id);
  if (i >= 0) { _toasts.splice(i, 1); listeners.forEach((l) => l()); }
}
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const cb = () => setToasts([..._toasts]);
    listeners.add(cb);
    cb();
    return () => { listeners.delete(cb); };
  }, []);
  return { toasts, push: pushToast, dismiss: dismissToast };
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-icon">{t.kind === 'success' ? '✓' : t.kind === 'warn' ? '⚠' : t.kind === 'error' ? '✗' : t.kind === 'action' ? '⚙' : 'ℹ'}</div>
          <div className="toast-content">
            <div className="toast-title">{t.title}</div>
            {t.description && <div className="toast-desc">{t.description}</div>}
            {t.actions && t.actions.length > 0 && (
              <div className="toast-actions">
                {t.actions.map((a, i) => (
                  <button key={i} className="ghost-btn" onClick={() => { a.onClick(); onDismiss(t.id); }}>{a.label}</button>
                ))}
              </div>
            )}
          </div>
          <button className="toast-close" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
