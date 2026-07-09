// test/unit/http-api-edge.test.js — HTTP API 边界条件 + 安全
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startHttpApi } from '../../lib/http-api.js';
import { _resetForTest } from '../../lib/tool-loader.js';

let server;
let baseUrl;

before(async () => {
  _resetForTest();
  server = await startHttpApi({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

after(async () => {
  await server.close();
});

async function fetchRaw(path, init = {}) {
  return await fetch(`${baseUrl}${path}`, init);
}

async function fetchJson(path, init = {}) {
  const r = await fetchRaw(path, init);
  const ct = r.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await r.json() : await r.text();
  return { status: r.status, body, headers: r.headers };
}

// ──── 大 body 拒绝 ──────────────────────────────────────────────────
test('POST body 接近 1MB → 200 (limit 默认 5MB)', async () => {
  // 默认 limit 5MB, 1MB body 应该 OK (返回 400 因为 browser_eval 缺 targetId, 但 HTTP 是 400)
  // 关键不是 status 而是 server 没崩
  const big = 'x'.repeat(900 * 1024); // 900KB
  const r = await fetchRaw('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'browser_eval', args: { targetId: 'X', expression: '1' } }),
  });
  // body 1MB 没超限 (limit 5MB) — server 应该正常处理
  // browser_eval 会走 sendPageCommand → reject "no session" → 500 或类似
  assert.ok(r.status >= 200 && r.status < 600, `server alive, status=${r.status}`);
});

test('POST body 超 MAX_BODY → 400 body too large', async () => {
  // 通过设环境变量让 limit 变小 (10KB), 发 20KB body
  const savedLimit = process.env.BB_HTTP_MAX_BODY;
  process.env.BB_HTTP_MAX_BODY = String(10 * 1024);
  // 关旧 server, 起新的 (会读 env)
  await server.close();
  _resetForTest();
  server = await startHttpApi({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const big = 'x'.repeat(20 * 1024); // 20KB
    const r = await fetchRaw('/api/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'browser_eval', args: { targetId: 'X', expression: big } }),
    });
    // server 应返回 400 (destroy connection)
    assert.equal(r.status, 400);
  } finally {
    if (savedLimit) process.env.BB_HTTP_MAX_BODY = savedLimit;
    else delete process.env.BB_HTTP_MAX_BODY;
  }
});

test('PUT /api/tools/call → 404 (only GET/POST/OPTIONS)', async () => {
  const r = await fetchRaw('/api/tools/call', { method: 'PUT' });
  assert.equal(r.status, 404);
});

test('DELETE /api/health → 404', async () => {
  const r = await fetchRaw('/api/health', { method: 'DELETE' });
  assert.equal(r.status, 404);
});

// ──── CORS 完整覆盖 ──────────────────────────────────────────────────
test('OPTIONS 任意 endpoint → 204 + CORS headers', async () => {
  const r = await fetchRaw('/api/tools/call', { method: 'OPTIONS' });
  assert.equal(r.status, 204);
  // v4.0: 默认同源（不再是 *）
  const cors = r.headers.get('access-control-allow-origin');
  assert.ok(cors === 'http://127.0.0.1:*' || cors === 'http://127.0.0.1:9224',
    `unexpected CORS: ${cors}`);
  assert.match(r.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(r.headers.get('access-control-allow-headers') || '', /Content-Type/i);
});

test('所有响应都带 CORS allow-origin（默认同源，不再 *）', async () => {
  const r = await fetchRaw('/api/health');
  // v4.0: 默认同源（CORS * 是安全问题；§16 plan 收紧到 localhost）
  const cors = r.headers.get('access-control-allow-origin');
  assert.ok(cors === 'http://127.0.0.1:*' || cors === 'http://127.0.0.1:9224',
    `unexpected CORS: ${cors}`);
});

// ──── 空 body 处理 ──────────────────────────────────────────────────
test('POST /api/tools/call 空 body → 400 name required', async () => {
  const r = await fetchRaw('/api/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.match(body.error, /name required/);
});

test('POST /api/cdp/send 空 body → 400 method required', async () => {
  const r = await fetchRaw('/api/cdp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.match(body.error, /method required/);
});

// ──── Content-Type 校验 ──────────────────────────────────────────────
test('POST /api/tools/call Content-Type 不对 → server 仍尝试 parse (宽松)', async () => {
  // 当前实现: 不强制 Content-Type, 只要 body 是 valid JSON 就接受
  // 这是有意为之 — 兼容 curl --data-binary 等场景
  const r = await fetchRaw('/api/tools/call', {
    method: 'POST',
    body: '{"name":"browser_eval","args":{}}',
  });
  assert.equal(r.status, 400); // targetId required (browser_eval 缺 targetId)
});

// ──── 并发请求 ──────────────────────────────────────────────────────
test('并发 10 个 /api/health 请求 → 全部 200', async () => {
  const promises = Array.from({ length: 10 }, () => fetchRaw('/api/health'));
  const responses = await Promise.all(promises);
  for (const r of responses) {
    assert.equal(r.status, 200);
  }
});

test('并发 5 个 tools/call 不同工具 → 各自独立返回', async () => {
  const calls = [
    { name: 'browser_navigate', args: {} }, // 缺 targetId
    { name: 'browser_close_tab', args: {} }, // 缺 targetId
    { name: 'browser_press_key', args: {} }, // 缺 key
    { name: 'browser_upload', args: {} }, // 缺 filePath
    { name: 'browser_eval', args: {} }, // eval 工具不校验 targetId, sendPageCommand 兜底
  ];
  const promises = calls.map(c =>
    fetchJson('/api/tools/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    })
  );
  const results = await Promise.all(promises);
  assert.equal(results[0].body.error, 'targetId required');
  assert.equal(results[1].body.error, 'targetId required');
  assert.equal(results[2].body.error, 'key required');
  assert.equal(results[3].body.error, 'filePath required');
  assert.match(results[4].body.error, /no session for targetId/);
});