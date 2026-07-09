// lib/cdp/send.js — CDP 命令发送 + 高层 wrapper
import WebSocket from 'ws';
import {
  _send, getBrowserWs, getSessionMap,
} from './transport.js';
import { ensureBridge } from './connection.js';

// ──── CircuitBreaker (熔断器) ─────────────────────────────────
// 防止 CDP 调用失败级联扩散：连续失败 N 次后"断路"，一段时间内不再尝试
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 3;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this._halfOpenCalls = 0;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker OPEN — CDP unavailable');
      }
      this.state = 'HALF_OPEN';
      this._halfOpenCalls = 0;
    }

    if (this.state === 'HALF_OPEN' && this._halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new Error('Circuit breaker HALF_OPEN — max probe calls reached');
    }

    if (this.state === 'HALF_OPEN') this._halfOpenCalls++;

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.halfOpenMaxCalls) this.state = 'CLOSED';
    }
  }

  _onFailure() {
    this.failures++;
    this.successes = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = 0;
    this._halfOpenCalls = 0;
  }
}

// 全局 CDP 熔断器
export const cdpCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
});

// sendCommand: 通用 CDP 命令发送
//   - 无 targetId → 走 Browser ws (browser-level commands)
//   - 有 targetId + session 存在 → 走 page session 自己的 ws (Chrome 124+ requires NO sessionId field)
//   - 走熔断器，防止 Chrome 断开后级联失败
export async function sendCommand(method, params = {}, targetId, timeout) {
  return cdpCircuitBreaker.execute(async () => {
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
  });
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