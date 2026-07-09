/**
 * WebPilot/lib/mcp-server.js
 * v4.0.0 (rebuild): MCP Streamable HTTP server.
 * Exposes WebPilot as MCP tools to any MCP client (Claude/Hana/Cursor/Continue/Hermes/...).
 *
 * v4.0 changes:
 * - Static zod import (no more race condition)
 * - Single version source (lib/version.js)
 * - Agent tracking via MCP initialize.clientInfo
 * - Response headers with protocol version
 */
import http from 'node:http';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { VERSION, PRODUCT_NAME, PROTOCOL_VERSION, VERSION_HEADERS, serverInfo } from './version.js';
import { loadAllTools } from './tool-loader.js';
import { validateArgs } from './zod-helper.js';
import { getAgentRegistry, AgentRegistry } from '../daemon/agent-registry.js';
import { getActivityLog } from '../daemon/activity-log.js';

// ──── internal: import tool module + return MCP schema wrapper ──────────
/**
 * 把 tools/*.js 的 parameters (JSON-Schema 风格) 转 zod schema.
 * 支持 type: string/number/boolean/array/object/enum.
 */
function paramsToZod(params) {
  const shape = {};
  for (const [k, v] of Object.entries(params || {})) {
    let s;
    if (v.enum) s = z.enum(v.enum);
    else if (v.type === 'string') s = z.string();
    else if (v.type === 'number') s = z.number();
    else if (v.type === 'boolean') s = z.boolean();
    else if (v.type === 'array') s = z.array(z.any());
    else if (v.type === 'object') s = z.record(z.any());
    else s = z.any();
    if (v.description && !s.description) {
      try { s = s.describe(v.description); } catch {}
    }
    if (!v.required) s = s.optional();
    shape[k] = s;
  }
  return z.object(shape).passthrough();
}

// ──── agent registry (in-process; daemon/agent-registry.js 将替换) ────
/** 已连接 Agent — 用 MCP initialize.clientInfo 自识别 */
const _connectedAgents = new Map();
export function getConnectedAgents() {
  return Array.from(_connectedAgents.values());
}

function trackAgent(connectionId, clientInfo) {
  const info = {
    id: connectionId,
    name: clientInfo?.name || 'Unknown Agent',
    version: clientInfo?.version || 'unknown',
    protocol: 'mcp',
    connectedAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  _connectedAgents.set(connectionId, info);
  console.error(`[mcp-server] agent connected: ${info.name} v${info.version} (${connectionId.slice(0, 8)})`);
  return info;
}

async function loadTool(filePath) {
  try {
    const mod = await import(`file://${filePath.replace(/\\/g, '/')}`);
    if (!mod.name || typeof mod.execute !== 'function' || !mod.parameters) {
      return null;
    }
    let inputSchema;
    try {
      inputSchema = paramsToZod(mod.parameters);
    } catch (e) {
      // fallback: passthrough
      inputSchema = z.object({}).passthrough();
    }
    const handler = async (args) => {
      const started = Date.now();
      try {
        // 双层校验: 客户端 (MCP SDK) + 服务端 (我们的 zod)
        const v = validateArgs(args, inputSchema);
        if (!v.valid) return { content: [{ type: 'text', text: JSON.stringify(v.error) }], isError: true };
        const result = await mod.execute(v.data || args || {}, {});
        const text = result?.content?.[0]?.text
          || (typeof result === 'string' ? result : JSON.stringify(result));
        // v4.0: activity log
        logActivity(mod.name, v.data || args, true, null, started);
        return {
          content: [{
            type: 'text',
            text: typeof text === 'string' ? text : JSON.stringify(text, null, 2),
          }],
        };
      } catch (err) {
        logActivity(mod.name, args, false, err.message, started);
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    };
    return {
      name: mod.name,
      description: (mod.description || mod.name).slice(0, 200),
      inputSchema,
      handler,
      _params: mod.parameters,
    };
  } catch {
    return null;
  }
}

// ──── load all tools/* ──────────────────────────────────────────────────
async function loadAllToolsLocal() {
  // 这里保留本地版本，因为 lib/tool-loader.js 是 plan 里的，
  // 真实工具加载会在 W1 day 3-4 切到 lib/tool-loader.js
  // 为避免循环依赖，先用内置逻辑
  const { readdirSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const TOOLS_DIR = join(__dirname, '..', 'tools');

  let files = [];
  try {
    files = readdirSync(TOOLS_DIR, { recursive: true, withFileTypes: true });
  } catch {
    files = [];
  }
  const jsFiles = files
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'))
    .map((e) => join(e.parentPath || e.path || TOOLS_DIR, e.name));
  const out = [];
  for (const f of jsFiles) {
    const t = await loadTool(f);
    if (t) out.push(t);
  }
  return out;
}

// ──── activity log helper — 每个 tool call 触发 ───────────────
function logActivity(tool, args, ok, error, started) {
  try {
    const registry = getAgentRegistry();
    const log = getActivityLog();
    // 当前 MCP 连接 = registry.list()[0] (per-client session 标记留给 Phase 2)
    const activeAgent = registry.list()[0] || { name: 'unknown', version: '' };
    log.log({
      agent: activeAgent.name,
      agentColor: AgentRegistry.colorFor(activeAgent.name),
      tool,
      args: sanitizeArgs(args),
      ok,
      error,
      durationMs: Date.now() - started,
      targetId: args?.targetId || null,
    });
    registry.recordCall(activeAgent.id, { ok });
  } catch (e) {
    // 静默 — activity log 失败不应阻塞 tool call
  }
}

function sanitizeArgs(args) {
  // 阻止 PII / cookie / Authorization 落到磁盘
  if (!args || typeof args !== 'object') return args;
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (/cookie|authorization|password|secret|token|key/i.test(k)) out[k] = '[REDACTED]';
    else if (k === 'value' && typeof v === 'string' && v.length > 200) out[k] = v.slice(0, 200) + '...';
    else out[k] = v;
  }
  return out;
}

// ──── start ──────────────────────────────────────────────────────────────
export async function startMcpServer(options = {}) {
  const port = options.port || parseInt(process.env.BB_MCP_PORT || '9223', 10);
  const host = options.host || process.env.BB_MCP_HOST || '127.0.0.1';
  const name = options.name || PRODUCT_NAME;
  const version = options.version || VERSION;

  const tools = await loadAllToolsLocal();
  console.error(`[mcp-server] loaded ${tools.length} tools`);

  const server = new McpServer({ name, version });

  // serverInfo 在 MCP initialize 时返回 — 告诉 Agent 我们的协议版本
  // （多数 MCP SDK 不读 serverInfo; VERSION 字段已设置也能识别)
  const serverInfoData = serverInfo();

  for (const tool of tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, tool.handler);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  // 监听 Agent 连入 — 用 MCP initialize 事件的 clientInfo 字段
  // 注意: StreamableHTTPServerTransport 暴露 onsessioninitialized 等事件
  // 我们简化处理: 所有 initialize 请求都会带 clientInfo; 在 transport handler 上注入
  await server.connect(transport);

  const httpServer = http.createServer((req, res) => {
    // 给所有响应加版本头
    for (const [k, v] of Object.entries(VERSION_HEADERS)) {
      res.setHeader(k, v);
    }

    const url = req.url || '/';
    if (url !== '/mcp' && url !== '/' && !url.startsWith('/mcp?')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'use POST /mcp' }));
      return;
    }
    if (req.method === 'POST' || req.method === 'GET') {
      transport.handleRequest(req, res).catch((err) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (req.method === 'DELETE') {
      transport.handleRequest(req, res).catch(() => {});
    } else {
      res.writeHead(405);
      res.end();
    }
  });

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, resolve);
  });

  const actualPort = httpServer.address().port;
  console.error(`[mcp-server] listening on http://${host}:${actualPort}/mcp (${tools.length} tools, v${version} protocol ${PROTOCOL_VERSION})`);

  return {
    host, port: actualPort, toolCount: tools.length,
    serverInfo: serverInfoData,
    close: async () => {
      try { await transport.close(); } catch {}
      await new Promise((resolve) => httpServer.close(resolve));
      // 清空 agent 列表
      _connectedAgents.clear();
    },
  };
}
