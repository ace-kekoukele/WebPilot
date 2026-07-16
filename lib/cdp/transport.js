// lib/cdp/transport.js — CDP 消息传输底层
// 提供: _send (发送 + bucket 路由), _wireUpEvents (响应分发), _openWs
// 所有 module-level state (_browserWs, _sessionMap, _pending, _eventListeners) 在此。
import WebSocket from 'ws';

export const COMMAND_TIMEOUT = parseInt(process.env.BB_CDP_TIMEOUT || '30000', 10);

// ──── module-level state (shared via getters/setters) ──────────────────
let _browserWs = null;
let _browserUrl = null;
let _nextId = 1;
const _sessionMap = new Map(); // targetId -> { ws, sessionId, bucketKey }
const _pending = new Map();    // bucketKey -> Map<id, {resolve, reject, timer}>
const _eventListeners = new Map();     // eventName -> Set<callback>  (全局)
const _sessionListeners = new Map();  // `${sessionId}:${eventName}` -> Set<callback>  (按 session)

// ──── internal: open WebSocket ────────────────────────────────────────
function _openWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', (e) => reject(e));
    setTimeout(() => reject(new Error(`open timeout: ${wsUrl}`)), 5000);
  });
}

// ──── internal: send command + wait response ─────────────────────────
// isPageSession=true: ws is page session's own ws (Chrome 124+ requires NO sessionId field on page ws).
// cdpSessionId: the CDP "sessionId" field to embed in the CDP message (null for page ws, null for browser-level commands).
// bucketKey: lookup key into _pending Map (must match _wireUpEvents sessionKey).
function _send(ws, cdpSessionId, bucketKey, method, params, timeout = COMMAND_TIMEOUT, isPageSession = false) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error(`ws not open: ${method}`));
    }
    const id = _nextId++;
    const timer = setTimeout(() => {
      _pending.get(bucketKey)?.delete(id);
      reject(new Error(`${method} timeout ${timeout}ms`));
    }, timeout);
    const bucket = _pending.get(bucketKey) || new Map();
    _pending.set(bucketKey, bucket);
    bucket.set(id, { resolve, reject, timer });

    const msg = { id, method, params: params || {} };
    if (cdpSessionId) msg.sessionId = cdpSessionId;
    if (process.env.BB_CDP_TRACE) console.error(`[ws:${bucketKey}] SEND id=${id} method=${method}`);
    ws.send(JSON.stringify(msg));
  });
}

// ──── internal: dispatch events ──────────────────────────────────────
function _wireUpEvents(ws, sessionKey) {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.id) {
      const bucket = _pending.get(sessionKey) || new Map();
      const pending = bucket.get(msg.id);
      if (process.env.BB_CDP_TRACE) console.error(`[ws:${sessionKey}] recv id=${msg.id} method=${msg.method || 'reply'} err=${msg.error?.message || ''}`);
      if (pending) {
        clearTimeout(pending.timer);
        bucket.delete(msg.id);
        if (msg.error) pending.reject(new Error(msg.error.message || 'CDP error'));
        else pending.resolve(msg.result || {});
      }
      return;
    }
    // CDP event — 全局 + session-specific 监听器
    if (msg.method) {
      const sessionId = msg.sessionId || null;

      const globalListeners = _eventListeners.get(msg.method);
      if (globalListeners) {
        for (const cb of globalListeners) {
          try { cb(msg.params || {}, sessionId); } catch {}
        }
      }

      if (sessionId) {
        const key = `${sessionId}:${msg.method}`;
        const sessionListeners = _sessionListeners.get(key);
        if (sessionListeners) {
          for (const cb of sessionListeners) {
            try { cb(msg.params || {}); } catch {}
          }
        }
      }
    }
  });
  ws.on('close', () => {
    const bucket = _pending.get(sessionKey);
    if (bucket) {
      for (const [, pending] of bucket) {
        clearTimeout(pending.timer);
        // v4.0: 用统一错误格式 (E_CODES.NOT_CONNECTED), 但 transport 层不依赖 zod-helper
        //        防止循环依赖. daemon 层会重新包装.
        pending.reject(new Error('E_NOT_CONNECTED: ws closed'));
      }
      bucket.clear();
    }
    // v4.0: emit 'ws:closed' 事件给 watchdog + module-cleanup 订阅
    //        注意先 emit, 然后才能让 connection 层做自己的清理
    emit('ws:closed', { sessionKey, code: ws._closeCode || null });
  });
}

// ──── public API ──────────────────────────────────────────────────────
export function getBrowserWs() { return _browserWs; }
export function setBrowserWs(ws) { _browserWs = ws; }
export function getBrowserUrl() { return _browserUrl; }
export function setBrowserUrl(url) { _browserUrl = url; }
export function getSessionMap() { return _sessionMap; }
export function getPending() { return _pending; }
export function getEventListeners() { return _eventListeners; }

export function getState() {
  return {
    connected: isConnected(),
    browserUrl: _browserUrl,
    tabCount: _sessionMap.size,
    pendingRequests: Array.from(_pending.values()).reduce((s, m) => s + m.size, 0),
  };
}

export function isConnected() {
  return Boolean(_browserWs && _browserWs.readyState === WebSocket.OPEN);
}

export function on(eventName, callback) {
  let set = _eventListeners.get(eventName);
  if (!set) {
    set = new Set();
    _eventListeners.set(eventName, set);
  }
  set.add(callback);
  return () => set.delete(callback);
}

export function off(eventName, callback) {
  _eventListeners.get(eventName)?.delete(callback);
}

/**
 * 按 sessionId 监听特定事件
 * @param {string} sessionId
 * @param {string} eventName
 * @param {Function} callback
 * @returns {() => void} unsubscribe
 */
export function onSession(sessionId, eventName, callback) {
  const key = `${sessionId}:${eventName}`;
  let set = _sessionListeners.get(key);
  if (!set) {
    set = new Set();
    _sessionListeners.set(key, set);
  }
  set.add(callback);
  return () => set.delete(callback);
}

export function offSession(sessionId, eventName, callback) {
  const key = `${sessionId}:${eventName}`;
  _sessionListeners.get(key)?.delete(callback);
}

export function emit(eventName, params, sessionId) {
  const listeners = _eventListeners.get(eventName);
  if (listeners) {
    for (const cb of listeners) {
      try { cb(params, sessionId); } catch {}
    }
  }
}

// ──── test hooks ──────────────────────────────────────────────────────
export function _resetForTest() {
  _browserWs = null;
  _browserUrl = null;
  _nextId = 1;
  _sessionMap.clear();
  _pending.clear();
  _eventListeners.clear();
  _sessionListeners.clear();
}

export function _setBrowserWsForTest(ws, url) {
  _browserWs = ws;
  _browserUrl = url || 'http://127.0.0.1:9222/json/version';
}

export function _registerSessionForTest(targetId, session) {
  _sessionMap.set(targetId, session);
}

export {
  _send, _wireUpEvents, _openWs,
  // 内部 state (给 connection / send 模块用)
  _browserWs as _t_browserWs, _sessionMap as _t_sessionMap,
  _pending as _t_pending, _browserUrl as _t_browserUrl,
};