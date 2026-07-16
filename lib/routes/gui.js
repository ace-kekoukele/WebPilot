// lib/routes/gui.js — GUI 元数据端点 (frontend fetch 调用)
// /api/agents, /api/activity, /api/browser/tabs, /api/gui-source
import { jsonResponse, pathOnly } from './_shared.js';
import { getAgentRegistry, AgentRegistry } from '../../daemon/agent-registry.js';
import { getActivityLog } from '../../daemon/activity-log.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/agents') {
    await handleGetAgents(req, res);
    return true;
  }
  if (method === 'GET' && url === '/api/activity') {
    await handleGetActivity(req, res);
    return true;
  }
  if (method === 'GET' && url === '/api/browser/tabs') {
    await handleGetBrowserTabs(req, res);
    return true;
  }
  if (method === 'GET' && url === '/api/gui-source') {
    await handleGuiSource(req, res);
    return true;
  }
  return false;
}

async function handleGetAgents(_req, res) {
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

async function handleGetBrowserTabs(_req, res) {
  try {
    const { listTabs } = await import('../cdp/index.js');
    const tabs = await listTabs();
    jsonResponse(res, 200, {
      ok: true,
      tabs: {
        user: tabs.filter((t) => !t.isAgent),
        agent: tabs.filter((t) => t.isAgent),
      },
    });
  } catch {
    // 没有 Chrome 时降级返回空, 不要 500
    jsonResponse(res, 200, { ok: true, tabs: { user: [], agent: [] } });
  }
}

async function handleGuiSource(_req, res) {
  try {
    const m = await import('../../daemon/static-server.js');
    // 触发 lazy init, 强制设置 _activeDirName
    m.getActiveStaticDir();
    jsonResponse(res, 200, {
      ok: true,
      source: m.getActiveStaticDirName() || 'none',
      path: m.getActiveStaticDir() || null,
    });
  } catch {
    jsonResponse(res, 200, { ok: true, source: 'unknown' });
  }
}