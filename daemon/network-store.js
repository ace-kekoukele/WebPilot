// daemon/network-store.js — §3.5.2 网络逆向
//
// 在 daemon 侧捕获 Chrome 的网络请求 (Network.* CDP events), 持久化, 提供:
//   - 网络面板 (前端): 表格 + 过滤 + 请求/响应详情
//   - 录制 (录一段后能导出 .har)
//   - Schema 推断 (从 JSON 响应提取字段类型 → 自动建模 API)
//   - Replay (重发请求 — 改 header/param/body 看响应变化 = 逆向核心)
//
// 内存 ring buffer (默认 5000 条). 持久化到 ~/.webpilot/network/<session>.jsonl
// 通过 lib/cdp/transport.js on('Network.requestWillBeSent') 等事件订阅

import { EventEmitter } from 'node:events';
import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync, unlinkSync, statSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { getConfigDir } from './config.js';
import { on as transportOn } from '../lib/cdp/transport.js';

const MAX_INMEM = 5000;

class NetworkStore extends EventEmitter {
  constructor() {
    super();
    /** @type {Array<NetworkEvent>} */
    this._events = [];
    /** @type {Map<string, NetworkEvent>} by requestId */
    this._byReqId = new Map();
    /** @type {Map<string, NetworkEvent>} by tabId */
    this._byTabId = new Map();
    this._sessionId = new Date().toISOString().slice(0, 10);
    this._wireCdp();
    this._rotate();
  }

  _dir() { return path.join(getConfigDir(), 'network'); }
  _sessionFile() { return path.join(this._dir(), `session-${this._sessionId}.jsonl`); }

  _ensureDir() { try { mkdirSync(this._dir(), { recursive: true }); } catch {} }

  _rotate() {
    try {
      if (!existsSync(this._dir())) return;
      const cutoff = Date.now() - 7 * 86400 * 1000;
      for (const f of readdirSync(this._dir())) {
        try {
          const p = path.join(this._dir(), f);
          const st = statSync(p);
          if (st.mtimeMs < cutoff) unlinkSync(p);
        } catch {}
      }
    } catch {}
  }

  _wireCdp() {
    // lib/cdp/transport.js on(eventName, cb) 在 transport.js emit 时触发
    try {
      transportOn('Network.requestWillBeSent', (params) => {
        const ev = {
          ts: Date.now(),
          phase: 'request',
          requestId: params.requestId,
          tabId: params.targetId || params.frameId || 'global',
          method: params.request?.method,
          url: params.request?.url,
          headers: params.request?.headers || {},
          postData: params.request?.postData,
          initiator: params.initiator,
        };
        this._add(ev);
      });
      transportOn('Network.responseReceived', (params) => {
        const ev = {
          ts: Date.now(),
          phase: 'response',
          requestId: params.requestId,
          tabId: params.targetId || params.frameId || 'global',
          status: params.response?.status,
          statusText: params.response?.statusText,
          headers: params.response?.headers || {},
          mimeType: params.response?.mimeType,
          fromCache: params.response?.fromDiskCache || params.response?.fromServiceWorker,
        };
        this._add(ev);
      });
      transportOn('Network.loadingFinished', (params) => {
        const ev = {
          ts: Date.now(),
          phase: 'finished',
          requestId: params.requestId,
          encodedDataLength: params.encodedDataLength,
        };
        this._add(ev);
      });
      transportOn('Network.loadingFailed', (params) => {
        const ev = {
          ts: Date.now(),
          phase: 'failed',
          requestId: params.requestId,
          errorText: params.errorText,
          canceled: params.canceled,
        };
        this._add(ev);
      });
      transportOn('Network.responseBody', (params) => {
        const requestId = params.requestId;
        const e = this._byReqId.get(requestId);
        if (e) e.responseBody = params.body;
        this.emit('body', { requestId, body: params.body });
      });
    } catch (e) {
      // transport 模块可能未装; daemon 启动早期
    }
  }

  _add(ev) {
    this._events.push(ev);
    if (this._events.length > MAX_INMEM) this._events.shift();
    // 按 requestId 合并
    if (ev.requestId) {
      const prev = this._byReqId.get(ev.requestId) || {};
      this._byReqId.set(ev.requestId, { ...prev, ...ev });
    }
    // 持久化 (异步 fire-and-forget)
    try {
      this._ensureDir();
      appendFileSync(this._sessionFile(), JSON.stringify(ev) + '\n');
    } catch {}
    this.emit('event', ev);
  }

  /** 合并的"完整请求-响应"列表 (按 requestId dedup) */
  query({ tabId, method, urlPattern, status, hasBody, since, until, limit = 200 } = {}) {
    // 用 Map 保证每个 requestId 只输出最新合并状态
    const merged = new Map();
    for (const e of this._events) {
      if (tabId && e.tabId !== tabId) continue;
      if (e.requestId) {
        const prev = merged.get(e.requestId) || {};
        merged.set(e.requestId, { ...prev, ...e });
      } else {
        merged.set(`_evt_${merged.size}`, e);
      }
    }
    let arr = Array.from(merged.values()).filter((e) => e.method || e.phase);   // 跳过纯finished没method的
    if (method) arr = arr.filter((e) => e.method === method);
    if (urlPattern) {
      const re = new RegExp(urlPattern);
      arr = arr.filter((e) => e.url && re.test(e.url));
    }
    if (typeof status === 'number') arr = arr.filter((e) => e.status === status);
    if (hasBody) arr = arr.filter((e) => e.responseBody);
    if (since) arr = arr.filter((e) => e.ts >= since);
    if (until) arr = arr.filter((e) => e.ts <= until);
    return arr.slice(-limit).reverse();   // 最新在前
  }

  /** 导出一个请求 (含响应体) 给 Replay 用 */
  exportRequest(requestId) {
    const merged = this._byReqId.get(requestId);
    if (!merged) return null;
    return {
      method: merged.method,
      url: merged.url,
      headers: merged.headers,
      postData: merged.postData,
      status: merged.status,
      statusText: merged.statusText,
      responseHeaders: merged.headers || {},   // response phase 已经覆盖回 response headers
      responseBody: merged.responseBody,
      mimeType: merged.mimeType,
      ts: merged.ts,
      encodedDataLength: merged.encodedDataLength,
    };
  }

  /** 推断 API schema (从合并事件里抽 JSON 响应字段类型) */
  inferSchema(requestId) {
    const e = this._byReqId.get(requestId);
    if (!e || !e.responseBody) return null;
    try {
      const body = JSON.parse(e.responseBody);   // base64 decode etc 留 v4.1
      return { url: e.url, status: e.status, schema: inferType(body, '') };
    } catch { return null; }
  }

  /** 清空 */
  clear() {
    this._events = [];
    this._byReqId.clear();
  }

  size() { return this._events.length; }
  uniqueCount() { return this._byReqId.size; }
}

let _singleton = null;
export function getNetworkStore() {
  if (!_singleton) _singleton = new NetworkStore();
  return _singleton;
}
// 也导出 class 给测试 / 多实例场景用
export { NetworkStore };

// ──── Schema 推断 (类型从 sample → TS-like signature) ──────────
function inferType(v, path) {
  if (v === null) return `${path}: null`;
  if (Array.isArray(v)) {
    if (v.length === 0) return `${path}: []`;
    const sample = v.find((x) => x !== null && x !== undefined);
    return `${path}: ${inferType(sample, '[]')} (length=${v.length})`;
  }
  if (typeof v === 'object') {
    const out = [];
    for (const [k, val] of Object.entries(v)) {
      const child = path ? `${path}.${k}` : k;
      out.push(inferType(val, child));
    }
    return out.join('\n');
  }
  return `${path}: ${typeof v}`;   // string/number/boolean
}
