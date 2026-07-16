// lib/routes/settings.js — /api/settings/<cat> GET / POST
import { jsonResponse, readBody, pathOnly } from './_shared.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (url.startsWith('/api/settings/') && url.length > 14) {
    const cat = url.slice(14);
    if (method === 'GET') {
      await handleSettingsGet(req, res, cat);
      return true;
    }
    if (method === 'POST') {
      await handleSettingsPost(req, res, cat);
      return true;
    }
  }
  return false;
}

/** 显式 cfg 字段映射 — 保持与 GUI 解析兼容 */
function buildSchema(cfg) {
  return {
    connection: {
      cdpPort:      { type: 'number', label: 'CDP 端口', value: cfg.cdp?.port ?? 9222 },
      mcpEnabled:   { type: 'boolean', label: '启用 MCP', value: cfg.mcp?.enabled ?? true },
      mcpPort:      { type: 'number', label: 'MCP 端口', value: cfg.mcp?.port ?? 9223 },
      httpEnabled:  { type: 'boolean', label: '启用 HTTP API', value: cfg.http?.enabled ?? true },
      httpPort:     { type: 'number', label: 'HTTP 端口', value: cfg.http?.port ?? 9224 },
      requireAuth:  { type: 'boolean', label: 'API token 鉴权', value: cfg.http?.requireAuth ?? false },
    },
    chrome: {
      preferredPath: { type: 'string', label: 'Chrome 路径（优先）', value: cfg.chrome?.path ?? '' },
    },
    proxy: {
      mode: { type: 'select', label: '代理模式', value: cfg.proxy?.mode ?? 'auto', options: [
        { value: 'off', label: '关 (直连)' },
        { value: 'system', label: '系统代理' },
        { value: 'custom', label: '自定义' },
        { value: 'auto', label: 'Auto (自动适配)' },
      ] },
    },
    ui: {
      theme: { type: 'select', label: '主题', value: cfg.ui?.theme ?? 'dark', options: [
        { value: 'dark', label: '暗色' },
        { value: 'light', label: '亮色' },
        { value: 'system', label: '跟随系统' },
      ] },
    },
    logs: {
      level: { type: 'select', label: '日志级别', value: cfg.logging?.level ?? 'info', options: [
        { value: 'trace', label: 'Trace' },
        { value: 'debug', label: 'Debug' },
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warn' },
        { value: 'error', label: 'Error' },
      ] },
      retentionDays: { type: 'number', label: '保留天数', value: cfg.logging?.retentionDays ?? 7 },
    },
    notifications: {
      enabled: { type: 'boolean', label: '启用通知', value: cfg.notifications?.enabled ?? true },
    },
    privacy: {
      redactSensitive: { type: 'boolean', label: '敏感字段自动脱敏', value: cfg.privacy?.redactSensitive ?? true },
    },
    advanced: {
      logLevel: { type: 'select', label: '内部日志级别', value: cfg.logging?.level ?? 'info', options: [
        { value: 'debug', label: 'Debug' },
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warn' },
      ] },
      pendingMapTtlMs: { type: 'number', label: '事件 TTL (ms)', value: cfg.cleanup?.pendingMapTtlMs ?? 30000 },
      eventListenerTtlMs: { type: 'number', label: '监听器 TTL (ms)', value: cfg.cleanup?.eventListenerTtlMs ?? 300000 },
    },
  };
}

async function handleSettingsGet(_req, res, cat) {
  let cfg;
  try { cfg = (await import('../../daemon/config.js')).currentConfig(); } catch { cfg = {}; }
  const schema = buildSchema(cfg);
  const out = schema[cat];
  if (!out) return jsonResponse(res, 404, { ok: false, error: `unknown category: ${cat}` });
  jsonResponse(res, 200, out);
}

async function handleSettingsPost(req, res, cat) {
  let body;
  try { body = await readBody(req, res); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }

  const patch = body.patch || body || {};
  if (Object.keys(patch).length === 0) return jsonResponse(res, 400, { ok: false, error: 'empty patch' });

  // 日志级别改完立刻生效
  if (patch.logLevel || patch.level) {
    try {
      const log = (await import('../../daemon/logger.js')).getLogger();
      if (log && typeof log.rotateIfNeeded === 'function') log.rotateIfNeeded();
    } catch {}
  }

  try {
    (await import('../../daemon/config.js')).patchConfig(patch);
    jsonResponse(res, 200, { ok: true, cat, patch, updated: true });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}