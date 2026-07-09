// lib/cdp/send.js — CDP 命令发送 + 高层 wrapper
import WebSocket from 'ws';
import {
  _send, getBrowserWs, getSessionMap,
} from './transport.js';
import { ensureBridge } from './connection.js';

// ──── CDP 错误码 ──────────────────────────────────────────────────────────────
/** @type {Record<string, {code: string, message: string, retryable: boolean}>} */
export const CDP_ERROR_CODES = {
  E_NOT_CONNECTED:     { code: 'E_NOT_CONNECTED',     message: 'CDP bridge 未连接', retryable: true },
  E_SESSION_CLOSED:    { code: 'E_SESSION_CLOSED',    message: 'Page session WebSocket 已关闭', retryable: false },
  E_TIMEOUT:           { code: 'E_TIMEOUT',           message: 'CDP 命令超时', retryable: true },
  E_PROTOCOL_ERROR:    { code: 'E_PROTOCOL_ERROR',    message: 'CDP 协议错误', retryable: true },
  E_INVALID_TARGET:    { code: 'E_INVALID_TARGET',    message: '无效的 targetId', retryable: false },
  E_BROWSER_CLOSED:    { code: 'E_BROWSER_CLOSED',   message: 'Chrome 浏览器已关闭', retryable: true },
  E_CIRCUIT_OPEN:      { code: 'E_CIRCUIT_OPEN',      message: '熔断器已断开，拒绝请求', retryable: false },
  E_SESSION_NOT_FOUND:  { code: 'E_SESSION_NOT_FOUND', message: '未找到 targetId 对应的 session', retryable: false },
  E_WS_CLOSED:         { code: 'E_WS_CLOSED',         message: 'WebSocket 连接已关闭', retryable: true },
};

export class CDPError extends Error {
  /**
   * @param {string} code - CDP_ERROR_CODES key
   * @param {string} [detail] - 额外上下文
   */
  constructor(code, detail = '') {
    const def = CDP_ERROR_CODES[code] || CDP_ERROR_CODES.E_PROTOCOL_ERROR;
    const msg = detail ? `${def.message}: ${detail}` : def.message;
    super(msg);
    this.name = 'CDPError';
    this.code = code;
    this.retryable = def.retryable;
  }
}

function isRetryableError(err) {
  if (err instanceof CDPError) return err.retryable;
  // 超时类错误字符串
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|socket hang up/i.test(err.message || '');
}

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
    if (!_browserWs) throw new CDPError('E_NOT_CONNECTED');
    if (targetId) {
      const sessionMap = getSessionMap();
      const session = sessionMap.get(targetId);
      if (session) {
        if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
          throw new CDPError('E_WS_CLOSED', `targetId=${targetId}`);
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
  if (!session) throw new CDPError('E_SESSION_NOT_FOUND', `targetId=${targetId}`);
  if (!session.ws || session.ws.readyState !== WebSocket.OPEN) {
    throw new CDPError('E_SESSION_CLOSED', `targetId=${targetId}`);
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