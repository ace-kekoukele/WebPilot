// test/unit/tool-loader.test.js — tool-loader 加载 + 调用 + 缓存
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllTools, callTool, _resetForTest } from '../../lib/tool-loader.js';

before(() => _resetForTest());
after(() => _resetForTest());

test('loadAllTools: 返回数组, 至少 40 个工具, 全部有 name + description + parameters + execute', async () => {
  const tools = await loadAllTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 40, `tool count = ${tools.length}`);
  for (const t of tools) {
    assert.ok(t.name, 'tool missing name');
    assert.ok(t.description, 'tool missing description');
    assert.ok(t.parameters, 'tool missing parameters');
    assert.equal(typeof t.execute, 'function', `${t.name}: execute not function`);
  }
});

test('loadAllTools: 第二次调用返回缓存 (同引用)', async () => {
  const a = await loadAllTools();
  const b = await loadAllTools();
  assert.equal(a, b, 'loadAllTools should return cached array');
});

test('callTool: 未知工具 → { ok: false, error: unknown tool }', async () => {
  const r = await callTool('browser_nope', {});
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown tool/);
});

test('callTool: browser_close_tab 无 targetId → { ok: false, error: targetId required }', async () => {
  const r = await callTool('browser_close_tab', {});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('callTool: 工具 execute 抛异常 → callTool 捕获并返回 { ok: false, error }', async () => {
  // 找一个会在无 Chrome 时抛的: sendPageCommand 会抛
  const r = await callTool('browser_eval', { targetId: 'FAKE_TID', expression: '1+1' });
  assert.equal(r.ok, false);
  assert.match(r.error, /no session/);
});