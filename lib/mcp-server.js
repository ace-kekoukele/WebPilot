// lib/mcp-server.js — MCP Streamable HTTP server (v4.0.4 — bridge 拆分版)
// 只负责 HTTP transport + McpServer 装配 + agent 追踪;工具加载已下沉到
// lib/mcp-tool-bridge.js (走 lib/tool-loader.js → loadAllTools → wrap zod)。
//
// v4.0 changes:
// - Static zod import (no more race condition)
// - Single version source (lib/version.js)
// - Agent tracking via MCP initialize.clientInfo
// - Response headers with protocol version
import http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { VERSION, PRODUCT_NAME, PROTOCOL_VERSION, VERSION_HEADERS, serverInfo } from './version.js';
import { loadToolsForMcp } from './mcp-tool-bridge.js';
import { getAgentRegistry, AgentRegistry } from '../daemon/agent-registry.js';
import { getActivityLog } from '../daemon/activity-log.js';

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

// ──── activity log (每个 tool call 触发) ─────────────────────────────
/**
 * 把 MCP 入口的 tool_call 同步写到 activity log + agent registry。
 * 失败静默 — 永远不应阻塞工具调用本身。
 */
function logActivity(tool, args, ok, error, started) {
  try {
    const registry = getAgentRegistry();
    const log = getActivityLog();
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
  } catch {}
}

/** PII/cookie/Authorization 自动脱敏; 长 value 截断 */
function sanitizeArgs(args) {
  if (!args || typeof args !== 'object') return args;
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (/cookie|authorization|password|secret|token|key/i.test(k)) out[k] = '[REDACTED]';
    else if (k === 'value' && typeof v === 'string' && v.length > 200) out[k] = v.slice(0, 200) + '...';
    else out[k] = v;
  }
  return out;
}

/**
 * 在 bridge 提供的 handler 外再包一层,加 activity log + 计时。
 * 避免 bridge 知道 daemon 层的存在(circular dep)。
 */
function wrapWithLogging(wrapped) {
  const orig = wrapped.handler;
  return async (args) => {
    const started = Date.now();
    let errText = null;
    let ok = true;
    try {
      const r = await orig(args);
      if (r?.isError) { ok = false; errText = r.content?.[0]?.text || null; }
      return r;
    } catch (e) {
      ok = false;
      errText = e.message;
      throw e;
    } finally {
      logActivity(wrapped.name, args, ok, errText, started);
    }
  };
}

// ──── start ──────────────────────────────────────────────────────────────
export async function startMcpServer(options = {}) {
  const port = options.port || parseInt(process.env.BB_MCP_PORT || '9223', 10);
  const host = options.host || process.env.BB_MCP_HOST || '127.0.0.1';
  const name = options.name || PRODUCT_NAME;
  const version = options.version || VERSION;

  const tools = await loadToolsForMcp();
  console.error(`[mcp-server] loaded ${tools.length} tools (v${version})`);

  const server = new McpServer({ name, version });

  for (const tool of tools) {
    server.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, wrapWithLogging(tool));
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });

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
    serverInfo: serverInfo(),
    close: async () => {
      try { await transport.close(); } catch {}
      await new Promise((resolve) => httpServer.close(resolve));
      _connectedAgents.clear();
    },
  };
}