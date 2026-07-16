// lib/routes/ports.js — /api/ports GET/POST (v4.0.1 端口管理)
import { jsonResponse, readBody, pathOnly } from './_shared.js';
import { DEFAULT_PORTS } from '../version.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/ports') {
    await handleGetPorts(req, res);
    return true;
  }
  if (method === 'POST' && url === '/api/ports') {
    await handleSetPorts(req, res);
    return true;
  }
  return false;
}

async function handleGetPorts(req, res) {
  try {
    const { currentConfig } = await import('../../daemon/config.js');
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
  try { body = await readBody(req, res); } catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  try {
    const { currentConfig, saveConfig } = await import('../../daemon/config.js');
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