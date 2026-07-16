// test/unit/_helpers.js — 共享 mock WebSocket (增强版)
// 原基础: send/replyTo/replyErrorTo
// 新增: 延迟回复 / 模拟 CDP 事件 / 模拟 close / 超时模拟
import { EventEmitter } from 'node:events';

export class MockWs extends EventEmitter {
  /**
   * @param {number} readyState - 1=OPEN, 3=CLOSED
   */
  constructor(readyState = 1 /* OPEN */) {
    super();
    this.readyState = readyState;
    this.sent = [];
    this._idCounter = 1;
    this._delayed = []; // [{id, delay, result}]
  }

  send(data) {
    if (this.readyState !== 1) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    this.sent.push(msg);
    this.emit('sent', msg);

    // 延迟回复队列
    const pending = this._delayed.find(d => d.id === msg.id);
    if (pending) {
      this._delayed = this._delayed.filter(d => d !== pending);
      setTimeout(() => {
        if (pending.error) {
          this.replyErrorToMsg(msg, pending.error);
        } else {
          this.replyToMsg(msg, pending.result);
        }
      }, pending.delay);
    }
  }

  replyToMsg(msg, result) {
    this.emit('message', JSON.stringify({ id: msg.id, result }));
  }

  replyErrorToMsg(msg, message) {
    this.emit('message', JSON.stringify({ id: msg.id, error: { code: -32001, message } }));
  }

  /** 回复第 i 条 (i=0 是第一条,i=1 是第二条,...) */
  replyTo(i, result) {
    const sent = this.sent[i];
    if (sent) this.replyToMsg(sent, result);
  }

  replyErrorTo(i, message) {
    const sent = this.sent[i];
    if (sent) this.replyErrorToMsg(sent, message);
  }

  /** 延迟 n ms 后回复第 i 条 */
  replyToDelayed(i, result, delayMs) {
    const sent = this.sent[i];
    if (sent) this._delayed.push({ id: sent.id, delay: delayMs, result });
  }

  /** 延迟 n ms 后报错 */
  replyErrorDelayed(i, message, delayMs) {
    const sent = this.sent[i];
    if (sent) this._delayed.push({ id: sent.id, delay: delayMs, error: message });
  }

  /** 模拟 CDP 事件到达 (broadcast to event listeners) */
  emitEvent(method, params = {}, sessionId = null) {
    this.emit('message', JSON.stringify({ method, params, sessionId }));
  }

  close(code = 1000, reason = 'normal') {
    this.readyState = 3;
    this.emit('close', { code, reason });
  }

  // 方便: 发送后自动回复 (链式)
  sendAndReply(result, delayMs = 0) {
    return new Promise((resolve) => {
      const onSent = () => {
        this.off('sent', onSent);
        setTimeout(() => {
          this.replyTo(0, result);
          resolve();
        }, delayMs);
      };
      this.on('sent', onSent);
    });
  }
}

export const WS_OPEN = 1;
export const WS_CLOSED = 3;
export const WS_CONNECTING = 0;

// ──── 模拟 CDP 响应体 ───────────────────────────────────────────────────────
export const CDP_FIXTURES = {
  navigate: (frameId = 'frame-1', loaderId = 'loader-1') => ({ frameId, loaderId }),
  evaluate: (value = 'test', type = 'string') => ({ result: { value, type } }),
  consoleAPICalled: (type = 'log', args = []) => ({
    type, args: args.map(a => ({ value: a })),
    stackTrace: { callFrames: [] },
  }),
  networkRequestWillBeSent: (requestId = 'req-1', url = 'https://example.com') => ({
    requestId,
    request: { method: 'GET', url, headers: {} },
    documentURL: url,
    initiator: {},
    timestamp: Date.now(),
  }),
  networkResponseReceived: (requestId = 'req-1', status = 200) => ({
    requestId,
    response: { status, statusText: 'OK', headers: {}, mimeType: 'text/html' },
    timestamp: Date.now(),
  }),
};

// ──── 快捷测试 helpers ─────────────────────────────────────────────────────
/**
 * 创建一个延迟打开的 MockWs
 * @param {number} delayMs - 连接延迟
 */
export function createDelayedWs(delayMs = 10) {
  const ws = new MockWs(0 /* CONNECTING */);
  setTimeout(() => {
    ws.readyState = 1;
    ws.emit('open');
  }, delayMs);
  return ws;
}

/**
 * 创建一个已关闭的 MockWs
 */
export function createClosedWs() {
  return new MockWs(WS_CLOSED);
}

/**
 * 等待 n ms 的 Promise
 */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
