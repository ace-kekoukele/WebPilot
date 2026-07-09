// src/lib/api.ts — HTTP client (区分 ECONNREFUSED / 5xx / 4xx,统一抛 ApiError 带 message)
export class ApiError extends Error {
  status: number;
  kind: 'network' | 'server' | 'client' | 'unknown';
  constructor(message: string, status: number, kind: ApiError['kind']) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

async function parseBody(r: Response): Promise<any> {
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('json')) {
    try { return await r.json(); } catch { return null; }
  }
  try { return await r.text(); } catch { return null; }
}

async function fail(r: Response | null, fallback: string): Promise<never> {
  if (!r) {
    throw new ApiError('daemon 没起 — 右键托盘 → 修复', 0, 'network');
  }
  const body = await parseBody(r);
  const msg = (body && (body.error || body.message)) || fallback;
  if (r.status >= 500) {
    throw new ApiError(`服务端错误: ${msg}`, r.status, 'server');
  }
  if (r.status >= 400) {
    throw new ApiError(msg, r.status, 'client');
  }
  throw new ApiError(fallback, r.status, 'unknown');
}

export async function apiGet(path: string): Promise<any> {
  let r: Response;
  try {
    r = await fetch(path);
  } catch (e: any) {
    throw new ApiError(`daemon 没起 (${e?.message || '网络失败'}) — 右键托盘 → 修复`, 0, 'network');
  }
  if (!r.ok) return fail(r, `${r.status} ${r.statusText}`);
  return parseBody(r);
}

export async function apiPost(path: string, body?: any): Promise<any> {
  let r: Response;
  try {
    r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  } catch (e: any) {
    throw new ApiError(`daemon 没起 (${e?.message || '网络失败'}) — 右键托盘 → 修复`, 0, 'network');
  }
  if (!r.ok) return fail(r, `${r.status} ${r.statusText}`);
  return parseBody(r);
}

export async function apiDelete(path: string): Promise<any> {
  let r: Response;
  try {
    r = await fetch(path, { method: 'DELETE' });
  } catch (e: any) {
    throw new ApiError(`daemon 没起 (${e?.message || '网络失败'}) — 右键托盘 → 修复`, 0, 'network');
  }
  if (!r.ok) return fail(r, `${r.status} ${r.statusText}`);
  return parseBody(r);
}

// 静默 helper — 自动吞 + toast, 用于 setInterval / 轮询 等不需要弹错的场景
import { pushToast } from '../components/Toast';
export async function apiGetSilent(path: string): Promise<any> {
  try { return await apiGet(path); } catch (e: any) { return null; }
}
export async function apiPostAndToast(path: string, body?: any, kind: 'info' | 'success' | 'warn' | 'error' = 'info'): Promise<any> {
  try {
    const r = await apiPost(path, body);
    if (kind !== 'info') pushToast({ kind, title: '✓ 成功' });
    return r;
  } catch (e: any) {
    pushToast({ kind: 'error', title: e.message || String(e) });
    throw e;
  }
}