// lib/routes/health.js — GET /api/health, GET /api/repair
import { jsonResponse, pathOnly, apiGetSelf } from './_shared.js';
import { VERSION, PRODUCT_NAME, PROTOCOL_VERSION, DEFAULT_PORTS, VERSION_HEADERS } from '../version.js';
import { loadAllTools } from '../tool-loader.js';
import * as cdp from '../cdp/index.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/health') {
    await handleHealth(req, res);
    return true;
  }
  if (method === 'GET' && url === '/api/repair') {
    await handleRepair(req, res);
    return true;
  }
  return false;
}

async function handleHealth(req, res) {
  const cdpConnected = cdp.isConnected();
  const tools = await loadAllTools();

  // 从 daemon state 拿当前实际端口 (v4.0 让用户看见真实端口)
  let portsInfo = null;
  try {
    const { currentConfig } = await import('../../daemon/config.js');
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
    ports: portsInfo,
    memory: process.memoryUsage ? {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
    } : null,
    nodeVersion: process.version,
    platform: process.platform,
    plugins: (() => {
      try {
        const { listPlugins, validatePlugins } = require('../../daemon/plugin-registry.js');
        return { status: listPlugins(), validation: validatePlugins() };
      } catch { return null; }
    })(),
  }, VERSION_HEADERS);
}

async function handleRepair(req, res) {
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