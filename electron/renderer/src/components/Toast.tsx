// src/components/Toast.tsx — Sonner 包装 (plan P6: 删手写 pub/sub, 改 Sonner)
// 保留 pushToast + dismissToast API 以最小化调用方改动
import { toast } from 'sonner';

export interface Toast {
  id: number;
  kind: 'success' | 'warn' | 'error' | 'info' | 'action';
  title: string;
  description?: string;
  duration?: number;
  actions?: Array<{ label: string; onClick: () => void }>;
  dismissLabel?: string;
}

let _id = 0;
export function pushToast(t: Omit<Toast, 'id'>) {
  _id++;
  const duration = t.duration ?? 4000;
  const id = String(_id);
  const opts: any = { duration, id, closeButton: true };
  if (t.description) opts.description = t.description;

  if (t.actions && t.actions.length > 0) {
    opts.action = {
      label: t.actions[0].label,
      onClick: () => { t.actions![0].onClick(); toast.dismiss(id); },
    };
  }
  opts.cancel = {
    label: t.dismissLabel ?? '关闭',
    onClick: () => toast.dismiss(id),
  };

  if (t.kind === 'success') toast.success(t.title, opts);
  else if (t.kind === 'error') toast.error(t.title, opts);
  else if (t.kind === 'warn') toast.warning(t.title, opts);
  else toast(t.title, opts);
  return _id;
}
export function dismissToast(id: number) { toast.dismiss(String(id)); }

// 保留兼容旧 API
export function useToasts() {
  return { toasts: [], push: pushToast, dismiss: dismissToast };
}

// ToastContainer 已废弃 (Sonner 自己管理渲染) — 保留空 export 以兼容旧调用
export function ToastContainer(_props: any) { return null; }