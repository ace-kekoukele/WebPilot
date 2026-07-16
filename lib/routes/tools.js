// lib/routes/tools.js — /api/tools/list, /api/tools/call, /api/cdp/send
import { jsonResponse, readBody, pathOnly } from './_shared.js';
import { callTool, loadAllTools } from '../tool-loader.js';
import * as cdp from '../cdp/index.js';

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/api/tools/list') {
    await handleToolsList(req, res);
    return true;
  }
  if (method === 'POST' && url === '/api/tools/call') {
    await handleToolCall(req, res);
    return true;
  }
  if (method === 'POST' && url === '/api/cdp/send') {
    await handleCdpSend(req, res);
    return true;
  }
  return false;
}

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
  try { body = await readBody(req, res); }
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
  try { body = await readBody(req, res); }
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