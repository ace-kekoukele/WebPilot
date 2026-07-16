// lib/routes/index.js — 路由调度入口: 顺序调用各域 matcher, 首个返回 true 即停。
// http-api.js 仅 require 此模块, 不再直接接触任何具体 handler。
import { dispatch, pathOnly, jsonResponse, CORS_BASE } from './_shared.js';
import { VERSION_HEADERS } from '../version.js';
// 静态 import 所有域 — 不延迟: 启动期就完成依赖图落位
import * as health from './health.js';
import * as tools from './tools.js';
import * as consoleRoute from './console.js';
import * as ports from './ports.js';
import * as gui from './gui.js';
import * as network from './network.js';
import * as recorder from './recorder.js';
import * as llm from './llm.js';
import * as settings from './settings.js';
import * as formats from './formats.js';

const MATCHERS = [
  health.match,
  tools.match,
  consoleRoute.match,
  ports.match,
  gui.match,
  network.match,
  recorder.match,
  llm.match,
  settings.match,
  formats.match,
];

/**
 * 顶层 dispatcher — 处理 CORS preflight + 路径白名单 + 域 matcher 链
 * @returns {boolean} true 表示已处理 (含 404), false 表示交给 static-server
 */
export async function handleHttp(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  // CORS preflight — v4.0: 默认同源（不再 * — §16 收紧）
  if (method === 'OPTIONS') {
    res.writeHead(204, { ...CORS_BASE, ...VERSION_HEADERS });
    res.end();
    return true;
  }

  // 白名单：/api/* + /mcp + /.well-known/* — 其它路径交给 static-server
  const isApi = url.startsWith('/api/');
  const isMcp = url === '/mcp' || url.startsWith('/mcp?');
  const isWellKnown = url.startsWith('/.well-known/');
  if (!isApi && !isMcp && !isWellKnown) return false;

  // 路由: 任意 matcher true 即停止 (含 404)
  try {
    const handled = await dispatch(MATCHERS, req, res);
    if (!handled) {
      jsonResponse(res, 404, { ok: false, error: `not found: ${method} ${url}` });
    }
  } catch (err) {
    console.error('[http-api] error:', err);
    if (!res.headersSent) jsonResponse(res, 500, { ok: false, error: err.message });
  }
  return true;
}