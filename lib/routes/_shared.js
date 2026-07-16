// lib/routes/_shared.js — 路由共享层（json/readBody/options/state/cors）
// 被 8 个路由模块共用。绝不依赖任何 daemon 业务代码。
import { DEFAULT_PORTS } from '../version.js';

// ──── HTTP 响应 + 跨域 ──────────────────────────────────────────────────
export const CORS_BASE = {
  'Access-Control-Allow-Origin': process.env.BB_HTTP_CORS_ORIGIN || 'http://127.0.0.1:*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const MAX_BODY = parseInt(process.env.BB_HTTP_MAX_BODY || String(5 * 1024 * 1024), 10);

/**
 * 写 JSON 响应 — 统一加 CORS + 版本头。
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 * @param {object} [extraHeaders]
 */
export function jsonResponse(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    ...CORS_BASE,
    ...extraHeaders,
  });
  res.end(data);
}

/**
 * 读 + 解析请求体（带大小限制；超过立刻 400 后 destroy socket）。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} [maxBytes]
 * @returns {Promise<object>}
 */
export function readBody(req, res, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        aborted = true;
        if (!res.headersSent) {
          jsonResponse(res, 400, { ok: false, error: `body too large (limit ${maxBytes} bytes)` });
        }
        try { req.destroy(); } catch {}
        reject(new Error('body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (aborted) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error(`invalid JSON: ${e.message}`)); }
    });
    req.on('error', (err) => { if (!aborted) reject(err); });
  });
}

// ──── 当前端口状态（startHttpApi 时回填）────────────────────────────────
let _httpPort = DEFAULT_PORTS.http;
export function currentHttpPort() { return _httpPort; }
export function setHttpPort(p) { _httpPort = p; }

// ──── daemon loopback helper（handleRepair 用）──────────────────────────
import http from 'node:http';
export function apiGetSelf(path) {
  return new Promise((resolve, reject) => {
    const port = currentHttpPort();
    const req = http.get(`http://127.0.0.1:${port}${path}`, (r) => {
      let data = '';
      r.on('data', (c) => (data += c));
      r.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`bad json: ${data.slice(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

// ──── 路由匹配调度器（http-api.js 通用 dispatch）────────────────────
/**
 * 顺序调用多个 matcher；任一返回 true 即停止。
 * matcher 签名: (req, res) => boolean | Promise<boolean>
 */
export async function dispatch(matchers, req, res) {
  for (const m of matchers) {
    if (await m(req, res)) return true;
  }
  return false;
}

/** 去掉 query string — 路由匹配用 */
export function pathOnly(req) {
  return (req.url || '/').split('?')[0];
}