// lib/cdp/send.js — CDP 命令发送 + 高层 wrapper
import WebSocket from 'ws';
import {
  _send, getBrowserWs, getSessionMap,
} from './transport.js';
import { ensureBridge } from './connection.js';

// sendCommand: 通用 CDP 命令发送
//   - 无 targetId → 走 Browser ws (browser-level commands)
//   - 有 targetId + session 存在 → 走 page session 自己的 ws (Chrome 124+ requires NO sessionId field)
export async function sendCommand(method, params = {}, targetId, timeout) {
  await ensureBridge();
  const _browserWs = getBrowserWs();
  if (!_browserWs) throw new Error('bridge not connected');
  if (targetId) {
    const sessionMap = getSessionMap();
    const session = sessionMap.get(targetId);
    if (session) {
      if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
        throw new Error(`page ws closed for targetId ${targetId}`);
      }
      return _send(session.ws, null, session.bucketKey, method, params, timeout, true);
    }
  }
  return _send(_browserWs, null, '_browser', method, params, timeout, false);
}

// sendPageCommand: 发到指定 Page session (P0 修复: 走 page ws + 不嵌 sessionId 字段)
export async function sendPageCommand(targetId, method, params = {}, timeout) {
  const sessionMap = getSessionMap();
  const session = sessionMap.get(targetId);
  if (!session) throw new Error(`no session for targetId ${targetId}`);
  if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
    throw new Error(`page ws closed for targetId ${targetId}`);
  }
  return _send(session.ws, null, session.bucketKey, method, params || {}, timeout, true);
}

// 高层 wrapper
export async function navigate(targetId, url) {
  return sendPageCommand(targetId, 'Page.navigate', { url }, 60000);
}

export async function evaluate(targetId, expression, opts = {}) {
  const params = {
    expression,
    returnByValue: opts.returnByValue !== false,
    awaitPromise: opts.awaitPromise !== false,
    userGesture: opts.userGesture !== false,
    timeout: opts.timeout || 0,
  };
  const r = await sendPageCommand(targetId, 'Runtime.evaluate', params);
  if (r.exceptionDetails) {
    return { error: r.exceptionDetails.exception?.description || 'JS exception', result: null };
  }
  return { result: r.result };
}

export async function setEnabled(opts = {}) {
  await ensureBridge();
  return { ok: true, port: parseInt(process.env.BB_CDP_PORT || '9222', 10), host: process.env.BB_CDP_HOST || '127.0.0.1' };
}