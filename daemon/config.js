// daemon/config.js — 配置文件加载 + 保存 + 热重载
//
// 存储位置: %LOCALAPPDATA%\BrowserBridge\config.json
//         | ~/Library/Application Support/BrowserBridge/config.json (v4.1)
//         | ~/.config/browserbridge/config.json (v4.1)
//
// 热加载: fs.watch + 500ms debounce; 调用 watchConfig(cb) 订阅.
// zod 校验加载, 失败 → 备份 + 走默认 + 警告事件.
import { existsSync, readFileSync, watch, writeFileSync, renameSync, promises as fs, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import { DEFAULT_PORTS, PRODUCT_NAME } from '../lib/version.js';

const CONFIG_DIR = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), PRODUCT_NAME)
  : process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', PRODUCT_NAME)
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), PRODUCT_NAME.toLowerCase());

const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// ──── zod schema (顶层) ──────────────────────────────────────────
const ConfigSchema = z.object({
  version: z.number().default(1),
  cdp: z.object({
    port: z.number().int().min(1024).max(65535).default(DEFAULT_PORTS.cdp),
    host: z.string().default('127.0.0.1'),
    autoStartChrome: z.boolean().default(true),
    autoReconnect: z.boolean().default(true),
    preferredPath: z.string().nullable().default(null),
  }).default({}),
  mcp: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().default(DEFAULT_PORTS.mcp),
    host: z.string().default('127.0.0.1'),
  }).default({}),
  http: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().default(DEFAULT_PORTS.http),
    host: z.string().default('127.0.0.1'),
    requireAuth: z.boolean().default(false),
    allowedOrigins: z.array(z.string()).default(['http://127.0.0.1:*']),
  }).default({}),
  control: z.object({
    enabled: z.boolean().default(true),
    port: z.number().int().default(DEFAULT_PORTS.control),
    token: z.string().nullable().default(null),
  }).default({}),
  chrome: z.object({
    path: z.string().nullable().default(null),
    userDataDir: z.string().nullable().default(null),
    extraArgs: z.array(z.string()).default([]),
  }).default({}),
  proxy: z.object({
    mode: z.enum(['off', 'system', 'custom', 'auto']).default('auto'),
    customHost: z.string().nullable().default(null),
    customPort: z.number().int().nullable().default(null),
    customType: z.enum(['http', 'https', 'socks5']).default('http'),
    customBypass: z.string().default('localhost,127.0.0.1,*.local'),
    detected: z.any().nullable().default(null),
  }).default({}),
  vpn: z.any().nullable().default(null),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    dir: z.string().nullable().default(null),
    retentionDays: z.number().int().default(7),
    maxTotalMB: z.number().int().default(500),
  }).default({}),
  autoLaunch: z.boolean().default(true),
  autoUpdate: z.object({
    enabled: z.boolean().default(false),
  }).default({}),
  cleanup: z.object({
    pendingMapTtlMs: z.number().int().default(30000),
    eventListenerTtlMs: z.number().int().default(300000),
  }).default({}),
  language: z.literal('zh-CN').default('zh-CN'),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('dark'),
    compact: z.boolean().default(false),
  }).default({}),
}).passthrough();  // 兼容未来加字段

// v4.0 永远只有 zh-CN
export const SUPPORTED_LANGUAGES = ['zh-CN'];

// ──── defaults ──────────────────────────────────────────────────
export const defaultConfig = {
  version: 1,
  cdp: { port: DEFAULT_PORTS.cdp, host: '127.0.0.1', autoStartChrome: true, autoReconnect: true, preferredPath: null },
  mcp: { enabled: true, port: DEFAULT_PORTS.mcp, host: '127.0.0.1' },
  http: { enabled: true, port: DEFAULT_PORTS.http, host: '127.0.0.1', requireAuth: false, allowedOrigins: ['http://127.0.0.1:*'] },
  control: { enabled: true, port: DEFAULT_PORTS.control, token: null },
  chrome: { path: null, userDataDir: null, extraArgs: [] },
  proxy: { mode: 'auto', customHost: null, customPort: null, customType: 'http', customBypass: 'localhost,127.0.0.1,*.local', detected: null },
  vpn: null,
  logging: { level: 'info', dir: null, retentionDays: 7, maxTotalMB: 500 },
  autoLaunch: true,
  autoUpdate: { enabled: false },
  cleanup: { pendingMapTtlMs: 30000, eventListenerTtlMs: 300000 },
  language: 'zh-CN',
  ui: { theme: 'dark', compact: false },
};

// ──── current state ─────────────────────────────────────────────
let _state = JSON.parse(JSON.stringify(defaultConfig));
let _loaded = false;

export function currentConfig() {
  return _state;
}

// 被当作子进程 (如 mcp-gateway) 拉起时, 允许用环境变量覆盖端口,
// 避免宿主进程自己也占了 config.json 里的默认端口造成冲突。
function applyEnvPortOverrides() {
  const mcpPort = process.env.BB_MCP_PORT ? parseInt(process.env.BB_MCP_PORT, 10) : null;
  const httpPort = process.env.BB_HTTP_PORT ? parseInt(process.env.BB_HTTP_PORT, 10) : null;
  if (mcpPort) _state.mcp = { ..._state.mcp, port: mcpPort };
  if (httpPort) _state.http = { ..._state.http, port: httpPort };
}

// ──── 加载 — 启动时调一次 ───────────────────────────────────────
export function loadConfig() {
  try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}

  if (!existsSync(CONFIG_PATH)) {
    _state = JSON.parse(JSON.stringify(defaultConfig));
    saveConfig();
    _loaded = true;
    applyEnvPortOverrides();
    return _state;
  }
  let raw;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch (e) {
    _state = JSON.parse(JSON.stringify(defaultConfig));
    applyEnvPortOverrides();
    return _state;
  }
  try {
    const parsed = JSON.parse(raw);
    const result = ConfigSchema.safeParse(parsed);
    if (result.success) {
      _state = result.data;
    } else {
      // 备份损坏文件, 走默认
      backupBrokenConfig(raw);
      _state = JSON.parse(JSON.stringify(defaultConfig));
    }
  } catch (e) {
    backupBrokenConfig(raw);
    _state = JSON.parse(JSON.stringify(defaultConfig));
  }
  _loaded = true;
  applyEnvPortOverrides();
  return _state;
}

function backupBrokenConfig(raw) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  try { copyFileSync(CONFIG_PATH, `${CONFIG_PATH}.broken-${ts}`); } catch {}
}

// ──── 保存 — 原子写（先临时文件 + rename） ──────────────────────
export function saveConfig() {
  try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}
  const tmpPath = `${CONFIG_PATH}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(_state, null, 2));
    renameSync(tmpPath, CONFIG_PATH);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ──── patches 合并 + save ───────────────────────────────────────
export function patchConfig(patch) {
  _state = mergeDeep(_state, patch);
  saveConfig();
  return _state;
}

function mergeDeep(target, patch) {
  const out = { ...target };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object') {
      out[k] = mergeDeep(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ──── 热加载 — fs.watch + 500ms debounce ───────────────────────
const _emitter = new EventEmitter();
let _watcher = null;
let _debounceTimer = null;

export function startWatching() {
  if (_watcher) return;
  if (!existsSync(CONFIG_DIR)) {
    try { mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}
  }
  try {
    _watcher = watch(CONFIG_DIR, (event, filename) => {
      if (filename !== 'config.json') return;
      if (_debounceTimer) clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => {
        const newConf = loadConfig();
        _emitter.emit('reloaded', newConf);
      }, 500);
    });
  } catch (e) {
    // inotify watcher limit 等 — 静默忽略
  }
}

export function onConfigReload(cb) {
  _emitter.on('reloaded', cb);
}

// ──── paths ─────────────────────────────────────────────────────
export function getConfigPath() { return CONFIG_PATH; }
export function getConfigDir() { return CONFIG_DIR; }
export function isLoaded() { return _loaded; }
