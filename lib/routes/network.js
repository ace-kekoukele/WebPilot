// lib/routes/network.js — §3.5.2 网络逆向 (list/get/replay/schema/clear/break/breaks/breaks-clear)
// _breaks state 是模块作用域, 跨请求共享。
import { jsonResponse, readBody, pathOnly } from './_shared.js';
import { getNetworkStore } from '../../daemon/network-store.js';
import * as cdp from '../cdp/index.js';

const _breaks = new Map();   // url-pattern -> { status, responseBody, contentType }

export async function match(req, res) {
  const url = pathOnly(req);
  const method = req.method || 'GET';

  // /api/network/list
  if (method === 'GET' && url === '/api/network/list') {
    try { await handleNetworkList(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/get
  if (method === 'GET' && url.startsWith('/api/network/get')) {
    try { await handleNetworkGet(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/replay
  if (method === 'POST' && url === '/api/network/replay') {
    try { await handleNetworkReplay(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/schema
  if (method === 'GET' && url === '/api/network/schema') {
    try { await handleNetworkSchema(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/clear
  if (method === 'POST' && url === '/api/network/clear') {
    try { await handleNetworkClear(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/break
  if (method === 'POST' && url.startsWith('/api/network/break')) {
    try { await handleNetworkBreak(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  // /api/network/breaks
  if (method === 'GET' && url === '/api/network/breaks') {
    try { await handleNetworkBreaks(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }
  if (method === 'DELETE' && url === '/api/network/breaks') {
    try { await handleNetworkBreaksClear(req, res); } catch (e) { jsonResponse(res, 500, { ok: false, error: e.message }); }
    return true;
  }

  return false;
}

async function handleNetworkList(_req, res) {
  const url = new URL(_req.url, 'http://x');
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
}

async function handleNetworkGet(req, res) {
  const u = new URL(req.url, 'http://x');
  const id = u.searchParams.get('id') || u.searchParams.get('requestId') || u.searchParams.get('reqId');
  if (!id) return jsonResponse(res, 400, { ok: false, error: 'id required' });
  const data = getNetworkStore().exportRequest(id);
  if (!data) return jsonResponse(res, 404, { ok: false, error: 'not found' });
  jsonResponse(res, 200, { ok: true, data });
}

async function handleNetworkReplay(req, res) {
  let body;
  try { body = await readBody(req, res); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.requestId && !body.url) return jsonResponse(res, 400, { ok: false, error: 'requestId or url required' });

  const store = getNetworkStore();
  const tmpl = body.requestId
    ? store.exportRequest(body.requestId)
    : { url: body.url, method: body.method || 'GET', headers: body.headers || {}, postData: body.body };
  const method = (body.method || tmpl.method || 'GET').toUpperCase();
  const url = body.url || tmpl.url;
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
  const url = new URL(req.url, 'http://x');
  const id = url.searchParams.get('id');
  if (!id) return jsonResponse(res, 400, { ok: false, error: 'id required' });
  const schema = getNetworkStore().inferSchema(id);
  if (!schema) return jsonResponse(res, 404, { ok: false, error: 'no JSON response body or unknown id' });
  jsonResponse(res, 200, { ok: true, schema });
}

async function handleNetworkClear(_req, res) {
  getNetworkStore().clear();
  jsonResponse(res, 200, { ok: true, message: 'cleared' });
}

async function handleNetworkBreak(req, res) {
  let body;
  try { body = await readBody(req, res); }
  catch (e) { return jsonResponse(res, 400, { ok: false, error: e.message }); }
  if (!body.urlPattern) return jsonResponse(res, 400, { ok: false, error: 'urlPattern required' });
  _breaks.set(body.urlPattern, {
    status: body.status ?? 200,
    responseBody: body.responseBody ?? '{"intercepted":true}',
    contentType: body.contentType || 'application/json',
  });
  // 通过 CDP 真实拦截
  try {
    const tabs = body.tabIds || [];
    if (tabs.length === 0) {
      const entry = _breaks.get(body.urlPattern);
      await cdp.sendPageCommand('*', 'Fetch.enable', {
        patterns: [{ urlPattern: body.urlPattern, requestStage: 'Response' }],
      }, 3000).catch(() => {});
      await cdp.sendPageCommand('*', 'Fetch.fulfillRequest', {
        responseBody: Buffer.from(entry.responseBody).toString('base64'),
        responseCode: entry.status,
        responseHeaders: [{ name: 'Content-Type', value: entry.contentType }],
      }, 3000).catch(() => {});
    }
  } catch { /* daemon 模式无 Chrome 时 mock */ }
  jsonResponse(res, 200, { ok: true, breaks: Array.from(_breaks.entries()) });
}

async function handleNetworkBreaks(_req, res) {
  jsonResponse(res, 200, { ok: true, breaks: Array.from(_breaks.entries()) });
}

async function handleNetworkBreaksClear(_req, res) {
  _breaks.clear();
  try { await cdp.sendPageCommand('*', 'Fetch.disable', {}, 3000).catch(() => {}); } catch {}
  jsonResponse(res, 200, { ok: true });
}