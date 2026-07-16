// lib/cdp/connection.js — Browser Target 连接管理 (v4.0.0)
import WebSocket from 'ws';
import {
  _openWs, _wireUpEvents,
  getBrowserWs, setBrowserWs, getBrowserUrl, setBrowserUrl,
  emit, _setBrowserWsForTest,
} from './transport.js';
import { DEFAULT_PORTS } from '../version.js';

const PORT = parseInt(process.env.BB_CDP_PORT || String(DEFAULT_PORTS.cdp), 10);
const HOST = process.env.BB_CDP_HOST || '127.0.0.1';

export { isConnected, getState } from './transport.js';

export async function ensureBridge(port = PORT, host = HOST) {
  const url = `http://${host}:${port}/json/version`;
  const _browserWs = getBrowserWs();
  const _browserUrl = getBrowserUrl();
  if (_browserWs && _browserUrl === url && _browserWs.readyState === WebSocket.OPEN) {
    return _browserWs;
  }
  if (_browserWs) {
    try { _browserWs.close(); } catch {}
    setBrowserWs(null);
  }
  let r;
  try {
    r = await fetch(url, { signal: AbortSignal.timeout(3000) });
  } catch (e) {
    emit('bridge:unreachable', { url, error: e.message });
    throw new Error(`Chrome unreachable on ${url}: ${e.message}`);
  }
  if (!r.ok) {
    emit('bridge:unreachable', { url, status: r.status });
    throw new Error(`Chrome unreachable on ${url}: HTTP ${r.status}`);
  }
  const v = await r.json();
  const ws = await _openWs(v.webSocketDebuggerUrl);
  setBrowserWs(ws);
  setBrowserUrl(url);
  _wireUpEvents(ws, '_browser');
  // v4.0: emit bridge:ready 给 cdp-watchdog + chrome-manager 订阅
  emit('bridge:ready', { url, browser: v.Browser, protocol: v['Protocol-Version'] });

  // v4.0: 自动启用 Network + Page domain (给网络逆向 / 页面分析)
  try {
    await sendCommand('Network.enable', {}, null, 2000);
    await sendCommand('Page.enable', {}, null, 2000);
    await sendCommand('Runtime.enable', {}, null, 2000);
  } catch (e) { /* ignore */ }

  return ws;
}

export async function disconnect() {
  const _browserWs = getBrowserWs();
  if (_browserWs) {
    try { _browserWs.close(); } catch {}
    setBrowserWs(null);
    setBrowserUrl(null);
  }
  const { getSessionMap } = await import('./transport.js');
  const sessionMap = getSessionMap();
  for (const [, s] of sessionMap) {
    try { s.ws.close(); } catch {}
  }
  sessionMap.clear();
  emit('bridge:disconnected', {});
}

export { _setBrowserWsForTest };