// lib/http-api.js — HTTP REST API for WebPilot (v4.0.0)
// 让工具能通过普通 HTTP 调用,绕过 MCP 协议 / schema 限制 / 单 transport 限制。
//
// Endpoints:
//   GET  /api/health           — 健康检查 (含版本 + 协议)
//   GET  /api/tools/list       — 工具列表 (含 parameters schema)
//   POST /api/tools/call       — { name, args } → { ok, value | error }
//   POST /api/cdp/send         — { method, params, targetId? } → { ok, result | error }
//
// 默认端口 9224 (MCP 9223 不冲突),可用 BB_HTTP_PORT / BB_HTTP_HOST 改。
import http from 'node:http';
import { callTool, loadAllTools } from './tool-loader.js';
import * as cdp from './cdp/index.js';
import { VERSION, PRODUCT_NAME, PROTOCOL_VERSION, VERSION_HEADERS, DEFAULT_PORTS } from './version.js';
import { loadPresets } from '../daemon/format-generators/presets.js';
import { getAgentRegistry, AgentRegistry } from '../daemon/agent-registry.js';
import { getActivityLog } from '../daemon/activity-log.js';
import { getNetworkStore } from '../daemon/network-store.js';
import { getRecorder, startRecorder, stopRecorder } from '../daemon/recorder.js';
import {
  loadLLMConfig, saveLLMConfig, listProviders, getActiveProvider,
  streamChat, executeToolCall,
} from '../daemon/llm-client.js';

const DEFAULT_PORT = parseInt(process.env.BB_HTTP_PORT || String(DEFAULT_PORTS.http), 10);
const DEFAULT_HOST = process.env.BB_HTTP_HOST || '127.0.0.1';

const MAX_BODY = parseInt(process.env.BB_HTTP_MAX_BODY || (5 * 1024 * 1024), 10); // 5MB default

// ──── helpers ──────────────────────────────────────────────────────────
function jsonResponse(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    // CORS: 默认同源 — settings.http.allowedOrigins 控制 (§16)
    'Access-Control-Allow-Origin': process.env.BB_HTTP_CORS_ORIGIN || 'http://127.0.0.1:*',
    ...VERSION_HEADERS,
  });
  res.end(data);
}

async function readBody(req, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > maxBytes) {
        aborted = true;
        // 先回 400,再 destroy — 让客户端拿到明确错误
        if (!res.headersSent) {
          jsonResponse(res, 400, { ok: false, error: `body too large (limit ${maxBytes} bytes)` });
        }
        req.destroy();
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

// ──── route handlers ────────────────────────────────────────────────────
async function handleHealth(req, res) {
  const cdpConnected = cdp.isConnected();
  const tools = await loadAllTools();
  // 从 daemon state 拿当前实际端口 (v4.0 让用户看见真实端口)
  let portsInfo = null;
  try {
    const { currentConfig } = await import('../daemon/config.js');
    const cfg = currentConfig();
    portsInfo = {
      cdp:      cfg.cdp.port,
      mcp:      cfg.mcp.port,
      http:     cfg.http.port,
      control:  cfg.control.port,
      sse:      DEFAULT_PORTS.sse,
      webhook:  DEFAULT_PORTS.webhook,
    };
  } catch {}
  jsonResponse(res, 200, {
    ok: true,
    name: PRODUCT_NAME,
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    cdpConnected,
    toolCount: tools.length,
    uptime: process.uptime(),
    ports: portsInfo,   // 实际占用的端口 (v4.0 让用户看见)
  });
}

async function handleConsoleStream(req, res) {
  // SSE: 新事件流式推
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  try {
    const { addSubscriber, removeSubscriber } = await import('../daemon/console-stream.js');
    addSubscriber(res);
    const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      removeSubscriber(res);
    });
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
    res.end();
  }
}

async function handleConsoleRecent(req, res) {
  try {
    const { getBuffer } = await import('../daemon/console-stream.js');
    const limit = Math.min(parseInt(new URL(req.url, 'http://x').searchParams.get('limit') || '200'), 1000);
    const all = getBuffer();
    jsonResponse(res, 200, { ok: true, events: all.slice(-limit) });
  } catch (e) {
    jsonResponse(res, 500, { ok: false, error: e.message });
  }
}

async function handleRepair(req, res) {
  // 4 段诊断: 健康 / Chrome / 端口 / 工具 — 全部走现有 endpoint, 不重复实现
  const phases = [];

  // 阶段 1: 健康
  try {
    const r = await apiGetSelf('/api/health');
    phases.push({
      id: 'health',
      ok: !!r.ok,
      msg: r.ok ? `daemon 跑通 (v${r.version})` : 'daemon 异常',
      detail: `tools=${r.toolCount} uptime=${Math.round(r.uptime || 0)}s`,
    });
  } catch (e) {
    phases.push({ id: 'health', ok: false, msg: 'daemon 不可达', detail: e.message });
  }

  // 阶段 2: Chrome CDP
  const health = phases[0]?.ok ? phases[0]?.detail : '';
  try {
    const tabs = await apiGetSelf('/api/browser/tabs');
    const allTabs = [...(tabs.tabs?.user || []), ...(tabs.tabs?.agent || [])];
    phases.push({
      id: 'chrome',
      ok: allTabs.length > 0,
      msg: allTabs.length > 0 ? `Chrome 已连接 (${allTabs.length} 个 tab)` : 'Chrome 未连接',
      detail: allTabs[0]?.url ? `首 tab: ${allTabs[0].url}` : '在 PowerShell 跑 chrome --remote-debugging-port=9222',
    });
  } catch (e) {
    phases.push({ id: 'chrome', ok: false, msg: 'Chrome 检测失败', detail: e.message });
  }

  // 阶段 3: 端口可用性
  try {
    const ports = await apiGetSelf('/api/ports');
    const list = Object.entries(ports.current || {}).map(([k, v]) => `${k}=${v}`);
    phases.push({
      id: 'ports',
      ok: true,
      msg: `端口配置 OK`,
      detail: list.join(', '),
    });
  } catch (e) {
    phases.push({ id: 'ports', ok: false, msg: '端口配置读取失败', detail: e.message });
  }

  // 阶段 4: 工具自检
  try {
    const r = await apiGetSelf('/api/tools/list');
    const tools = r.tools || [];
    const named = tools.filter((t) => t.name).length;
    phases.push({
      id: 'tools',
      ok: named === tools.length && tools.length > 0,
      msg: tools.length > 0 ? `工具已加载 (${tools.length})` : '工具未加载',
      detail: `${named}/${tools.length} 命名正确`,
    });
  } catch (e) {
    phases.push({ id: 'tools', ok: false, msg: '工具列表拉取失败', detail: e.message });
  }

  const okCount = phases.filter((p) => p.ok).length;
  jsonResponse(res, 200, {
    ok: okCount === phases.length,
    passed: okCount,
    total: phases.length,
    phases,
  });
}

// 内部 helper: 自己调自己 (HTTP loopback 用默认端口)
function apiGetSelf(path) {
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
let _httpPort = DEFAULT_PORTS.http;
function currentHttpPort() { return _httpPort; }

async function handleToolsList(req, res) {
  const tools = await loadAllTools();
  jsonResponse(res, 200, {
    ok: true,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  });
}

async function handleToolCall(req, res) {
  let body;
  try { body = await readBody(req); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.name) {
    return jsonResponse(res, 400, { ok: false, error: 'name required' });
  }
  const result = await callTool(body.name, body.args || {});
  const status = result.ok ? 200 : 400;
  jsonResponse(res, status, result);
}

async function handleCdpSend(req, res) {
  let body;
  try { body = await readBody(req); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.method) {
    return jsonResponse(res, 400, { ok: false, error: 'method required' });
  }
  try {
    let result;
    if (body.targetId) {
      result = await cdp.sendPageCommand(body.targetId, body.method, body.params || {});
    } else {
      result = await cdp.sendCommand(body.method, body.params || {});
    }
    jsonResponse(res, 200, { ok: true, result });
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

// ──── v4.0 新增: 多格式工具清单生成器 (see §17) ────────────────
async function handleOpenApi(req, res) {
  try {
    const { openapi, loadAllToolsSpec } = await import('../daemon/format-generators/index.js');
    const tools = await loadAllToolsSpec();
    const spec = openapi.generate(tools, { version: VERSION });
    jsonResponse(res, 200, spec);
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

async function handleFormatRoute(req, res, format) {
  try {
    const generators = await import('../daemon/format-generators/index.js');
    if (!generators[format]) {
      return jsonResponse(res, 404, { ok: false, error: `unknown format: ${format}` });
    }
    const tools = await generators.loadAllToolsSpec();
    const out = generators[format].generate(tools);
    jsonResponse(res, 200, out);
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

// A2A protocol agent card (see §25)
async function handleA2A(req, res) {
  try {
    const tools = await (await import('../daemon/format-generators/index.js')).loadAllToolsSpec();
    jsonResponse(res, 200, {
      id: 'webpilot',
      name: PRODUCT_NAME,
      version: VERSION,
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        streaming: true,
        tools: tools.length,
        pushNotifications: false,
        stateTransitionHistory: false,
      },
      defaultInputModes: ['application/json'],
      defaultOutputModes: ['application/json'],
      skills: tools.map((t) => ({
        id: t.name,
        name: t.name,
        description: t.description,
        tags: ['browser', 'cdp'],
        examples: [],
        inputModes: ['application/json'],
        outputModes: ['application/json'],
      })),
      provider: {
        organization: 'WebPilot',
        url: 'https://github.com/ace-kekoukele/webpilot',
      },
      urls: [],
    });
  } catch (err) {
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

// ═══════════ v4.0 GUI 端点（前端 fetch 调用） ═══════════
async function handleGuiSource(req, res) {
  try {
    const m = await import('../daemon/static-server.js');
    // 触发 lazy init, 强制设置 _activeDirName
    m.getActiveStaticDir();
    jsonResponse(res, 200, {
      ok: true,
      source: m.getActiveStaticDirName() || 'none',
      path: m.getActiveStaticDir() || null,
    });
  } catch (e) { jsonResponse(res, 200, { ok: true, source: 'unknown' }); }
}

async function handleGetAgents(req, res) {
  try {
    const agents = getAgentRegistry().list().map((a) => ({
      ...a,
      color: AgentRegistry.colorFor(a.name),
    }));
    jsonResponse(res, 200, { ok: true, agents });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleGetActivity(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const limit = parseInt(url.searchParams.get('limit') || '200', 10);
    const events = getActivityLog().query({ limit });
    jsonResponse(res, 200, { ok: true, events });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleGetBrowserTabs(req, res) {
  try {
    const { listTabs } = await import('../lib/cdp/index.js');
    const tabs = await listTabs();
    const result = { ok: true, tabs: { user: tabs.filter((t) => !t.isAgent), agent: tabs.filter((t) => t.isAgent) } };
    jsonResponse(res, 200, result);
  } catch (e) {
    jsonResponse(res, 200, { ok: true, tabs: { user: [], agent: [] } });
  }
}

// ──── v4.0.1 端口管理 (v4.0 让用户看见实际端口) ───────────────
async function handleGetPorts(req, res) {
  try {
    const { currentConfig } = await import('../daemon/config.js');
    const { getPortEvents } = await import('../daemon/main.js');
    const cfg = currentConfig();
    jsonResponse(res, 200, {
      ok: true,
      current: {
        cdp:      cfg.cdp.port,
        mcp:      cfg.mcp.port,
        http:     cfg.http.port,
        control:  cfg.control.port,
      },
      defaults: {
        cdp:      DEFAULT_PORTS.cdp,
        mcp:      DEFAULT_PORTS.mcp,
        http:     DEFAULT_PORTS.http,
        control:  DEFAULT_PORTS.control,
      },
      migrated: Object.entries(cfg).some(([k, v]) => v && v.port && k !== 'cdp' && v.port !== DEFAULT_PORTS[k]),
      hint: '默认 9222-9227. 若被占用, daemon 会自动迁移. 可在 settings 改回.',
    });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleSetPorts(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  try {
    const { currentConfig, saveConfig } = await import('../daemon/config.js');
    const cfg = currentConfig();
    const newCfg = { ...cfg };
    const parsed = {};
    for (const k of ['cdp', 'mcp', 'http', 'control']) {
      if (body[k] != null) {
        const p = parseInt(body[k], 10);
        if (isNaN(p) || p < 1024 || p > 65535) {
          return jsonResponse(res, 400, { ok: false, error: `${k} 端口必须 1024-65535` });
        }
        parsed[k] = p;
      }
    }
    // 交叉验证: 4 个端口必须互不相同
    const ports = ['cdp', 'mcp', 'http', 'control'].map((k) => parsed[k] ?? cfg[k]?.port);
    if (new Set(ports).size !== ports.length) {
      return jsonResponse(res, 400, { ok: false, error: '4 个端口必须互不相同' });
    }
    for (const k of ['cdp', 'mcp', 'http', 'control']) {
      if (parsed[k] != null) newCfg[k] = { ...(newCfg[k] || {}), port: parsed[k] };
    }
    saveConfig(newCfg);
    // 端口变更需要重启 daemon
    jsonResponse(res, 200, {
      ok: true,
      message: '端口已保存. 需要重启 daemon 生效.',
      restartRequired: true,
      newPorts: { cdp: newCfg.cdp.port, mcp: newCfg.mcp.port, http: newCfg.http.port, control: newCfg.control.port },
    });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleGetLLMProviders(req, res) {
  try {
    const presets = loadPresets();
    const configured = listProviders();
    const activeId = loadLLMConfig().activeId;
    jsonResponse(res, 200, {
      ok: true,
      // 16 个 preset (一键填充用)
      presets: presets.map((p) => ({
        id: p.id, name: p.name, baseUrl: p.baseUrl,
        defaultModel: p.defaultModel, availableModels: p.availableModels,
        region: (p.regions || []).join(','),
      })),
      // 用户已配置的 provider (含 apiKey)
      configured: configured.map((p) => ({
        id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model,
        type: p.type, active: p.id === activeId,
        hasKey: !!p.apiKey,
      })),
      active: activeId,
    });
  } catch (e) { jsonResponse(res, 200, { ok: true, providers: [], configured: [], active: null }); }
}

async function handleSetActiveLLM(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  // 接 3 种动作: 选 preset 添加 / 直接配置 / 切换 active
  const cfg = loadLLMConfig();
  if (body.action === 'add-preset') {
    // body: { presetId, apiKey, name? }
    const preset = loadPresets().find((p) => p.id === body.presetId);
    if (!preset) return jsonResponse(res, 400, { ok: false, error: 'preset not found' });
    if (!body.apiKey) return jsonResponse(res, 400, { ok: false, error: 'apiKey required' });
    cfg.providers.push({
      id: preset.id + '-' + Date.now(),
      name: body.name || preset.name,
      baseUrl: preset.baseUrl,
      apiKey: body.apiKey,
      model: body.model || preset.defaultModel,
      type: preset.id.includes('anthropic') ? 'anthropic'
          : preset.id.includes('gemini') ? 'gemini'
          : 'openai-compatible',
      presetId: preset.id,
    });
    cfg.activeId = cfg.providers[cfg.providers.length - 1].id;
  } else if (body.action === 'add-custom') {
    if (!body.name || !body.baseUrl || !body.apiKey || !body.model) return jsonResponse(res, 400, { ok: false, error: 'name + baseUrl + apiKey + model required' });
    cfg.providers.push({
      id: 'custom-' + Date.now(),
      name: body.name, baseUrl: body.baseUrl, apiKey: body.apiKey,
      model: body.model, type: body.type || 'openai-compatible',
    });
    cfg.activeId = cfg.providers[cfg.providers.length - 1].id;
  } else if (body.action === 'activate') {
    if (!cfg.providers.find((p) => p.id === body.id)) return jsonResponse(res, 400, { ok: false, error: 'id not in providers' });
    cfg.activeId = body.id;
  } else if (body.action === 'delete') {
    cfg.providers = cfg.providers.filter((p) => p.id !== body.id);
    if (cfg.activeId === body.id) cfg.activeId = cfg.providers[0]?.id || null;
  } else {
    return jsonResponse(res, 400, { ok: false, error: 'unknown action: ' + body.action });
  }
  saveLLMConfig(cfg);
  jsonResponse(res, 200, { ok: true, activeId: cfg.activeId, providers: cfg.providers.map((p) => ({ ...p, hasKey: !!p.apiKey })) });
}

async function handleLLMChat(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  // body: { sessionId, messages: [{role, content}], tools: [toolName...] }
  // 真流式 (SSE): 把 streamChat 的每个 chunk 立刻写给 client
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'X-WebPilot-Version': VERSION,
    'Connection': 'keep-alive',
  });

  // 工具 schema (跟 activity-log + tool-loader 对接)
  let tools = [];
  try {
    const { loadAllTools } = await import('../lib/tool-loader.js');
    const all = await loadAllTools();
    if (Array.isArray(body.tools) && body.tools.length > 0) {
      tools = all.filter((t) => body.tools.includes(t.name));
    } else {
      tools = all;
    }
  } catch {}

  try {
    let fullText = '';
    const toolCalls = [];
    for await (const ev of streamChat({ messages: body.messages, tools })) {
      if (ev.content) {
        fullText += ev.content;
        res.write(`data: ${JSON.stringify({ type: 'content', delta: ev.content })}\n\n`);
      } else if (ev.toolCall) {
        // 1. 立刻推 tool_call 给 client
        res.write(`data: ${JSON.stringify({ type: 'tool_call', toolCall: { name: ev.toolCall.name, args: ev.toolCall.args } })}\n\n`);
        // 2. 真的执行 tool
        const r = await executeToolCall(ev.toolCall.name, ev.toolCall.args);
        toolCalls.push({ name: ev.toolCall.name, args: ev.toolCall.args, result: r, ts: Date.now() });
        res.write(`data: ${JSON.stringify({ type: 'tool_result', name: ev.toolCall.name, result: r })}\n\n`);
      } else if (ev.done) {
        res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolCalls })}\n\n`);
        res.end();
        return;
      }
    }
    res.write(`data: ${JSON.stringify({ type: 'done', text: fullText, toolCalls })}\n\n`);
    res.end();
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
    res.end();
  }
}

async function handleSettingsGet(req, res, cat) {
  let cfg;
  try {
    const { currentConfig } = await import('../daemon/config.js');
    cfg = currentConfig();
  } catch { cfg = {}; }

  const schema = {
    connection: {
      cdpPort:        { type: 'number', label: 'CDP 端口', value: cfg.cdp?.port ?? 9222 },
      mcpEnabled:    { type: 'boolean', label: '启用 MCP', value: cfg.mcp?.enabled ?? true },
      mcpPort:       { type: 'number', label: 'MCP 端口', value: cfg.mcp?.port ?? 9223 },
      httpEnabled:   { type: 'boolean', label: '启用 HTTP API', value: cfg.http?.enabled ?? true },
      httpPort:      { type: 'number', label: 'HTTP 端口', value: cfg.http?.port ?? 9224 },
      requireAuth:   { type: 'boolean', label: 'API token 鉴权', value: cfg.http?.requireAuth ?? false },
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
      ]},
    },
    ui: {
      theme: { type: 'select', label: '主题', value: cfg.ui?.theme ?? 'dark', options: [
        { value: 'dark', label: '暗色' },
        { value: 'light', label: '亮色' },
        { value: 'system', label: '跟随系统' },
      ]},
    },
    logs: {
      level: { type: 'select', label: '日志级别', value: cfg.logging?.level ?? 'info', options: [
        { value: 'trace', label: 'Trace' },
        { value: 'debug', label: 'Debug' },
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warn' },
        { value: 'error', label: 'Error' },
      ]},
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
      ]},
      pendingMapTtlMs: { type: 'number', label: '事件 TTL (ms)', value: cfg.cleanup?.pendingMapTtlMs ?? 30000 },
      eventListenerTtlMs: { type: 'number', label: '监听器 TTL (ms)', value: cfg.cleanup?.eventListenerTtlMs ?? 300000 },
    },
  };
  const out = schema[cat] || {};
  jsonResponse(res, 200, out);
}

async function handleSettingsPost(req, res, cat) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }

  let patch;
  try { patch = body.patch || body; } catch { patch = {}; }
  if (Object.keys(patch).length === 0) return jsonResponse(res, 400, { ok: false, error: 'empty patch' });

  // 日志级别改完立刻生效 (logger 每次写时会读 currentConfig)
  if (patch.logLevel || patch.level) {
    try {
      const { getLogger } = await import('../daemon/logger.js');
      // logger.rotateIfNeeded() 会从 currentConfig 重读 level
      const log = getLogger();
      if (log && typeof log.rotateIfNeeded === 'function') log.rotateIfNeeded();
    } catch {}
  }

  try {
    const { patchConfig } = await import('../daemon/config.js');
    const updated = patchConfig(patch);
    jsonResponse(res, 200, { ok: true, cat, patch, updated: true });
  } catch (e) {
    jsonResponse(res, 500, { ok: false, error: e.message });
  }
}

// ═══════════ §3.5.2 网络逆向端点 ═══════════
async function handleNetworkList(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const filters = {
      tabId: url.searchParams.get('tabId') || undefined,
      method: url.searchParams.get('method') || undefined,
      urlPattern: url.searchParams.get('urlPattern') || undefined,
      status: url.searchParams.has('status') ? parseInt(url.searchParams.get('status'), 10) : undefined,
      hasBody: url.searchParams.get('hasBody') === '1',
      limit: parseInt(url.searchParams.get('limit') || '200', 10),
    };
    const events = getNetworkStore().query(filters);
    jsonResponse(res, 200, { ok: true, count: events.length, events, storeSize: getNetworkStore().size() });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleNetworkGet(req, res, url) {
  // /api/network/get?id=<requestId> 或 /api/network/get?reqId=...
  try {
    const u = new URL(req.url, 'http://x');
    const id = u.searchParams.get('id') || u.searchParams.get('requestId') || u.searchParams.get('reqId');
    if (!id) return jsonResponse(res, 400, { ok: false, error: 'id required' });
    const data = getNetworkStore().exportRequest(id);
    if (!data) return jsonResponse(res, 404, { ok: false, error: 'not found' });
    jsonResponse(res, 200, { ok: true, data });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleNetworkReplay(req, res) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.requestId && !body.url) return jsonResponse(res, 400, { ok: false, error: 'requestId or url required' });
  const store = getNetworkStore();
  // 优先用原请求为模板
  const tmpl = body.requestId ? store.exportRequest(body.requestId) : { url: body.url, method: body.method || 'GET', headers: body.headers || {}, postData: body.body };
  const method = (body.method || tmpl.method || 'GET').toUpperCase();
  const url = body.url || tmpl.url;
  // 合并 headers (用户覆盖优先)
  const headers = { ...(tmpl.headers || {}), ...(body.headers || {}) };
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : (body.body ?? tmpl.postData),
    });
    const text = await r.text();
    let parsed = text;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('json')) {
      try { parsed = JSON.parse(text); } catch {}
    }
    jsonResponse(res, 200, {
      ok: true,
      replay: {
        url, method,
        requestHeaders: headers,
        responseStatus: r.status,
        responseStatusText: r.statusText,
        responseHeaders: Object.fromEntries(r.headers),
        responseBody: text.length > 200000 ? text.slice(0, 200000) + '...[truncated]' : text,
        parsedResponse: parsed,
        durationMs: Date.now() - start,
        size: text.length,
      },
    });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: `replay failed: ${e.message}` }); }
}

async function handleNetworkSchema(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    const id = url.searchParams.get('id');
    if (!id) return jsonResponse(res, 400, { ok: false, error: 'id required' });
    const schema = getNetworkStore().inferSchema(id);
    if (!schema) return jsonResponse(res, 404, { ok: false, error: 'no JSON response body or unknown id' });
    jsonResponse(res, 200, { ok: true, schema });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleNetworkClear(req, res) {
  getNetworkStore().clear();
  jsonResponse(res, 200, { ok: true, message: 'cleared' });
}

// 网络拦截 / Mock — §17 网站逆向核心
const _breaks = new Map();   // url-pattern -> { responseBody, status }
async function handleNetworkBreak(req, res, url) {
  let body;
  try { body = await readBody(req); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.urlPattern) return jsonResponse(res, 400, { ok: false, error: 'urlPattern required' });
  _breaks.set(body.urlPattern, {
    status: body.status ?? 200,
    responseBody: body.responseBody ?? '{"intercepted":true}',
    contentType: body.contentType || 'application/json',
  });
  // 通过 CDP 真实拦截
  try {
    const { sendPageCommand } = await import('./cdp/index.js');
    const tabs = body.tabIds || [];   // 限定某些 tab, 空数组=所有
    if (tabs.length === 0) {
      // 给所有现有 tab 加 Fetch.enable + pattern
      const networkStore = getNetworkStore();
      // 简化: 单 tab
      await sendPageCommand('*', 'Fetch.enable', { patterns: [{ urlPattern: body.urlPattern, requestStage: 'Response' }] }, 3000).catch(() => {});
      await sendPageCommand('*', 'Fetch.fulfillRequest', { responseBody: Buffer.from(_breaks.get(body.urlPattern).responseBody).toString('base64'), responseCode: _breaks.get(body.urlPattern).status, responseHeaders: [{ name: 'Content-Type', value: _breaks.get(body.urlPattern).contentType }] }, 3000).catch(() => {});
    }
  } catch (e) { /* daemon 模式无 Chrome 时 mock */ }
  jsonResponse(res, 200, { ok: true, breaks: Array.from(_breaks.entries()) });
}

async function handleNetworkBreaks(req, res) {
  jsonResponse(res, 200, { ok: true, breaks: Array.from(_breaks.entries()) });
}

async function handleNetworkBreaksClear(req, res) {
  _breaks.clear();
  try {
    const { sendPageCommand } = await import('./cdp/index.js');
    await sendPageCommand('*', 'Fetch.disable', {}, 3000).catch(() => {});
  } catch {}
  jsonResponse(res, 200, { ok: true });
}

// ──── §3.6 录制器端点 ────────────────────────────────────────────
async function handleRecorderStart(req, res) {
  try {
    const body = await readBody(req);
    const { targetId } = body;
    startRecorder(targetId || null);
    jsonResponse(res, 200, { ok: true, recording: true });
  } catch (e) { jsonResponse(res, 400, { ok: false, error: e.message }); }
}

async function handleRecorderStop(req, res) {
  try {
    stopRecorder();
    const r = getRecorder();
    jsonResponse(res, 200, { ok: true, recording: false, eventCount: r.events().length });
  } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
}

async function handleRecorderStatus(req, res) {
  const r = getRecorder();
  jsonResponse(res, 200, { ok: true, recording: r.isRecording(), eventCount: r.events().length });
}

async function handleRecorderEvents(req, res) {
  const r = getRecorder();
  const url = new URL(req.url, 'http://x');
  const limit = parseInt(url.searchParams.get('limit') || '500', 10);
  jsonResponse(res, 200, { ok: true, events: r.events().slice(-limit) });
}

// ──── router ────────────────────────────────────────────────────────────
async function handle(req, res) {
  // 去掉 query 字符串再匹配路由
  const rawUrl = req.url || '/';
  const url = rawUrl.split('?')[0];
  const method = req.method || 'GET';

  // CORS preflight — v4.0: 默认同源（不再 * — §16 收紧）
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': process.env.BB_HTTP_CORS_ORIGIN || 'http://127.0.0.1:*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...VERSION_HEADERS,
    });
    return res.end();
  }

  // v4.0: 只接管 /api/* + /mcp + /.well-known/* — 其它路径交给 static-server
  const isApi = url.startsWith('/api/');
  const isMcp = url === '/mcp' || url.startsWith('/mcp?');
  const isWellKnown = url.startsWith('/.well-known/');
  if (!isApi && !isMcp && !isWellKnown) return;   // 让 static-server 处理

  try {
    if (method === 'GET' && url === '/api/health') return handleHealth(req, res);
    if (method === 'GET' && url === '/api/repair') return handleRepair(req, res);
    if (method === 'GET' && url === '/api/console/stream') return handleConsoleStream(req, res);
    if (method === 'GET' && url === '/api/console/recent') return handleConsoleRecent(req, res);
    if (method === 'GET' && url === '/api/tools/list') return handleToolsList(req, res);
    if (method === 'POST' && url === '/api/tools/call') return handleToolCall(req, res);
    if (method === 'POST' && url === '/api/cdp/send') return handleCdpSend(req, res);
    if (method === 'GET' && url === '/api/openapi.json') return handleOpenApi(req, res);
    if (method === 'GET' && url === '/api/formats/openai') return handleFormatRoute(req, res, 'openai');
    if (method === 'GET' && url === '/api/formats/anthropic') return handleFormatRoute(req, res, 'anthropic');
    if (method === 'GET' && url === '/api/formats/gemini') return handleFormatRoute(req, res, 'gemini');
    if (method === 'GET' && url === '/api/formats/a2a') return handleA2A(req, res);
    if (method === 'GET' && url === '/api/agents') return handleGetAgents(req, res);
    if (method === 'GET' && url === '/api/activity') return handleGetActivity(req, res);
    if (method === 'GET' && url === '/api/gui-source') return handleGuiSource(req, res);
    if (method === 'GET' && url === '/api/ports') return handleGetPorts(req, res);
    if (method === 'POST' && url === '/api/ports') return handleSetPorts(req, res);
    if (method === 'GET' && url === '/api/browser/tabs') return handleGetBrowserTabs(req, res);
    if (method === 'GET' && url === '/api/llm/providers') return handleGetLLMProviders(req, res);
    if (method === 'POST' && url === '/api/llm/active') return handleSetActiveLLM(req, res);
    if (method === 'POST' && url === '/api/llm/chat') return handleLLMChat(req, res);
    if (method === 'GET' && url.startsWith('/api/settings/')) return handleSettingsGet(req, res, url.slice(14));
    if (method === 'POST' && url.startsWith('/api/settings/')) return handleSettingsPost(req, res, url.slice(14));

    // §3.5.2 网络逆向 端点
    if (method === 'GET' && url === '/api/network/list') return handleNetworkList(req, res);
    if (method === 'GET' && url.startsWith('/api/network/get')) return handleNetworkGet(req, res, url);
    if (method === 'POST' && url === '/api/network/replay') return handleNetworkReplay(req, res);
    if (method === 'GET' && url === '/api/network/schema') return handleNetworkSchema(req, res);
    if (method === 'POST' && url === '/api/network/clear') return handleNetworkClear(req, res);
    if (method === 'POST' && url.startsWith('/api/network/break')) return handleNetworkBreak(req, res, url);
    if (method === 'GET' && url === '/api/network/breaks') return handleNetworkBreaks(req, res);
    if (method === 'DELETE' && url === '/api/network/breaks') return handleNetworkBreaksClear(req, res);

    // §3.6 录制器 端点
    if (method === 'POST' && url === '/api/recorder/start') return handleRecorderStart(req, res);
    if (method === 'POST' && url === '/api/recorder/stop') return handleRecorderStop(req, res);
    if (method === 'GET' && url === '/api/recorder/status') return handleRecorderStatus(req, res);
    if (method === 'GET' && url === '/api/recorder/events') return handleRecorderEvents(req, res);
    jsonResponse(res, 404, { ok: false, error: `not found: ${method} ${url}` });
  } catch (err) {
    console.error('[http-api] error:', err);
    jsonResponse(res, 500, { ok: false, error: err.message });
  }
}

// ──── start ────────────────────────────────────────────────────────────
export async function startHttpApi(options = {}) {
  // options.port 可能是 0 (auto-pick) — 不能用 || fallback
  const port = options.port !== undefined ? options.port : DEFAULT_PORT;
  const host = options.host || DEFAULT_HOST;

  // pre-warm tool cache
  const tools = await loadAllTools();
  console.error(`[http-api] loaded ${tools.length} tools`);

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[http-api] unhandled:', err);
      if (!res.headersSent) jsonResponse(res, 500, { ok: false, error: err.message });
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address();
      if (actual && typeof actual === 'object') _httpPort = actual.port;
      resolve();
    });
  });

  // v4.0: 静态文件 serve (GUI 在用户 Chrome 里打开)
  try {
    const { attachStaticHandlers } = await import('../daemon/static-server.js');
    attachStaticHandlers(server);
    console.error(`[http-api] static GUI attached at http://${host}:${port}/`);
  } catch (e) {
    console.error(`[http-api] static attach failed: ${e.message}`);
  }

  const actualPort = server.address().port;
  console.error(`[http-api] listening on http://${host}:${actualPort}/api/* (${tools.length} tools)`);
  return {
    host, port: actualPort, toolCount: tools.length,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// Allow direct execution: `node lib/http-api.js`
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  startHttpApi().catch((err) => {
    console.error('[http-api] failed to start:', err);
    process.exit(1);
  });
}