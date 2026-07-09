// tools/browser_extract_apis.js — 从已捕获的 network 流量中提取 API 模式 (§3.5.2)
// 核心逆向能力:
//   - 扫所有 XHR/fetch 的 URL pattern, 推断 REST 风格端点
//   - 列出 query params / 请求头规范
//   - 根据响应头/体推断返回结构
//
// 用法:
//   1. 先用浏览器正常操作一段时间 (让流量积累)
//   2. 调 browser_extract_apis, 拿到所有 API 端点+典型请求/响应

import { evaluate } from '../lib/cdp/index.js';

export const name = 'browser_extract_apis';
export const description = '从运行时抓到的 XHR/fetch 流量提取 API 端点 (§3.5.2 后端逆向)';
export const parameters = {
  targetId: { type: 'string', required: true },
  minCalls: { type: 'number', description: '至少被调 N 次才算 API' },
};

const CAPTURE_JS = `() => {
  if (window.__webpilot_apiCapture) return window.__webpilot_apiCapture;
  const calls = [];
  const origFetch = window.fetch;
  window.fetch = (...args) => {
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      const opts = args[1] || {};
      calls.push({
        ts: Date.now(), type: 'fetch', method: (opts.method || 'GET').toUpperCase(),
        url: String(url), headers: opts.headers || {},
        body: opts.body ? String(opts.body).slice(0, 500) : null,
      });
    } catch {}
    return origFetch.apply(window, args);
  };
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__wpMethod = m; this.__wpUrl = u; return origXhrOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) {
    calls.push({
      ts: Date.now(), type: 'xhr', method: (this.__wpMethod || 'GET').toUpperCase(),
      url: String(this.__wpUrl), body: b ? String(b).slice(0, 500) : null,
    });
    return origXhrSend.apply(this, arguments);
  };
  window.__webpilot_apiCapture = calls;
  return { installed: true, existingCount: calls.length };
}`;

const GROUP_JS = `(minCalls) => {
  const raw = window.__webpilot_apiCapture || [];
  // 用 path template 分组 (去掉 query / 数字 ID / hash)
  function templatize(url) {
    try {
      const u = new URL(url, location.href);
      const path = u.pathname.replace(/\\/[0-9a-f-]{8,}|\\/[0-9]+/gi, '/{id}');
      const qs = [...u.searchParams.keys()].sort();
      return u.origin + path + (qs.length ? '?' + qs.join('&') : '');
    } catch { return url; }
  }
  const groups = new Map();
  for (const c of raw) {
    const t = templatize(c.url);
    if (!groups.has(t)) groups.set(t, { url: t, method: c.method, samples: [], types: new Set() });
    const g = groups.get(t);
    g.types.add(c.type);
    if (g.samples.length < 3) g.samples.push({ url: c.url.slice(0, 300), ts: c.ts });
  }
  const out = [];
  for (const [t, g] of groups) {
    if (g.samples.length >= minCalls) {
      out.push({
        url: g.url,
        method: g.method,
        sources: [...g.types],
        callCount: g.samples.length,
        examples: g.samples,
      });
    }
  }
  // 按调用次数降序
  out.sort((a, b) => b.callCount - a.callCount);
  return out;
}`;

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    const minCalls = args.minCalls || 1;
    // 装 capturer
    const cap = await evaluate(args.targetId, CAPTURE_JS, { returnByValue: true, awaitPromise: false });
    if (cap.exceptionDetails) return { ok: false, error: 'install: ' + cap.exceptionDetails.exception?.description };
    // 抓现在的所有调用
    const calls = await evaluate(args.targetId, GROUP_JS, {
      args: { minCalls },
      returnByValue: true,
      awaitPromise: false,
    });
    if (calls.exceptionDetails) return { ok: false, error: calls.exceptionDetails.exception?.description };
    const apis = calls.result?.value || [];
    return {
      ok: true,
      installInfo: cap.result?.value,
      totalUniqueApis: apis.length,
      totalCallsCaptured: apis.reduce((s, a) => s + a.callCount, 0),
      apis,
    };
  } catch (err) { return { ok: false, error: err.message }; }
}
