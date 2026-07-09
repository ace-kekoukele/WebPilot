// lib/cdp/target.js — Target / Tab 管理
import {
  _openWs, _wireUpEvents, getSessionMap, setBrowserWs,
} from './transport.js';
import { ensureBridge } from './connection.js';
import { sendCommand, sendPageCommand } from './send.js';

const PORT = parseInt(process.env.BB_CDP_PORT || '9222', 10);
const HOST = process.env.BB_CDP_HOST || '127.0.0.1';

export async function listTargets() {
  await ensureBridge();
  const r = await fetch(`http://${HOST}:${PORT}/json/list`, { signal: AbortSignal.timeout(3000) });
  if (!r.ok) throw new Error(`list HTTP ${r.status}`);
  return await r.json();
}

export async function listTabs() {
  const all = await listTargets();
  return all
    .filter((t) => t.type === 'page' || t.type === 'iframe' || t.type === 'background_page')
    .map((t) => ({
      targetId: t.id,
      type: t.type,
      title: t.title || '',
      url: t.url || '',
      webSocketDebuggerUrl: t.webSocketDebuggerUrl,
    }));
}

export async function newTab(url = 'about:blank') {
  await ensureBridge();
  const { targetId } = await sendCommand('Target.createTarget', { url, background: false });
  await new Promise((r) => setTimeout(r, 300));
  let sessionId = null;
  try {
    const r = await sendCommand('Target.attachToTarget', { targetId, flatten: true });
    sessionId = r.sessionId;
  } catch (e) {
    console.error('[cdp] Target.attachToTarget failed:', e.message);
  }
  const all = await fetch(`http://${HOST}:${PORT}/json/list`).then((r) => r.json());
  const t = all.find((x) => x.id === targetId);
  if (!t) throw new Error(`targetId ${targetId} not found in /json/list`);
  const ws = await _openWs(t.webSocketDebuggerUrl);
  _wireUpEvents(ws, sessionId || `page:${targetId}`);
  getSessionMap().set(targetId, { ws, sessionId, bucketKey: sessionId || `page:${targetId}` });
  return { targetId, sessionId };
}

export async function closeTab(targetId) {
  await ensureBridge();
  const sessionMap = getSessionMap();
  if (sessionMap.has(targetId)) {
    try {
      await sendCommand('Target.detachFromTarget', {
        sessionId: sessionMap.get(targetId).sessionId,
      });
    } catch {}
    try { sessionMap.get(targetId).ws.close(); } catch {}
    sessionMap.delete(targetId);
  }
  try { await sendCommand('Target.closeTarget', { targetId }); } catch {}
}

export async function getPageWsUrl(targetId) {
  const all = await listTargets();
  const t = all.find((x) => x.id === targetId);
  return t?.webSocketDebuggerUrl;
}