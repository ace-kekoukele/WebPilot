// src/lib/api.ts — HTTP client
export async function apiGet(path: string): Promise<any> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : r.text();
}
export async function apiPost(path: string, body?: any): Promise<any> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  const ct = r.headers.get('content-type') || '';
  return ct.includes('json') ? r.json() : r.text();
}
export async function apiDelete(path: string): Promise<any> {
  const r = await fetch(path, { method: 'DELETE' });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json().catch(() => ({}));
}
