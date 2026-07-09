// test/unit/http-api.test.js — HTTP API 路由分发 + 错误处理
// 不依赖 Chrome:tool-loader 走真实加载但所有 tool.execute 在无 Chrome 时会快速失败。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHttpApi } from '../../lib/http-api.js';
import { _resetForTest } from '../../lib/tool-loader.js';

let server;
let baseUrl;

before(async () => {
  _resetForTest();
  // 用 0 让系统选端口,避免冲突
  server = await startHttpApi({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

after(async () => {
  await server.close();
});

async function fetchJson(path, init = {}) {
  const r = await fetch(`${baseUrl}${path}`, init);
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await r.json() : await r.text();
  return { status: r.status, body, headers: r.headers };
}

test('GET /api/health → ok + toolCount >= 40 + cdpConnected is boolean', async () => {
  const r = await fetchJson('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(r.body.toolCount >= 40, `toolCount=${r.body.toolCount}`);
  assert.equal(typeof r.body.cdpConnected, 'boolean');
  assert.equal(typeof r.body.uptime, 'number');
});

test('GET /api/tools/list → ok + 数组 + 含 browser_eval', async () => {
  const r = await fetchJson('/api/tools/list');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.ok(Array.isArray(r.body.tools));
  assert.ok(r.body.tools.length >= 40);
  assert.ok(r.body.tools.some(t => t.name === 'browser_eval'));
});

test('GET /api/nope → 404 + not found', async () => {
  const r = await fetchJson('/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.body.ok, false);
  assert.match(r.body.error, /not found/);
});

test('POST /api/tools/call 空 body → 400 name required', async () => {
  const r = await fetchJson('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /name required/);
});

test('POST /api/tools/call 未知工具 → 400 + ok:false + unknown tool', async () => {
  const r = await fetchJson('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":"browser_does_not_exist","args":{}}',
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.ok, false);
  assert.match(r.body.error, /unknown tool/);
});

test('POST /api/tools/call browser_navigate 无 targetId → ok:false targetId required', async () => {
  const r = await fetchJson('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":"browser_navigate","args":{}}',
  });
  assert.equal(r.status, 400);
  assert.equal(r.body.ok, false);
  assert.match(r.body.error, /targetId required/);
});

test('POST /api/cdp/send 无 method → 400 method required', async () => {
  const r = await fetchJson('/api/cdp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /method required/);
});

test('POST /api/tools/call bad JSON → 400 invalid JSON', async () => {
  const r = await fetchJson('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /invalid JSON/);
});

test('OPTIONS /api/tools/call → 204 + CORS headers', async () => {
  const r = await fetchJson('/api/tools/call', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  assert.ok(r.headers.get('access-control-allow-origin'));
  assert.ok(r.headers.get('access-control-allow-methods'));
});

test('POST /api/tools/call Response Content-Type 是 JSON', async () => {
  const r = await fetchJson('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.match(r.headers.get('content-type') || '', /application\/json/);
});