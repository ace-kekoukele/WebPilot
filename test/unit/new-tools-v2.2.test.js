// test/unit/new-tools-v2.2.test.js — Chrome 150 新工具 v2.2 测试 (5 个)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const NEW_TOOLS = [
  { name: 'browser_security', description: /Security|安全/i },
  { name: 'browser_service_worker', description: /Service Worker|ServiceWorker/i },
  { name: 'browser_memory', description: /内存|Memory/i },
  { name: 'browser_a11y', description: /无障碍|Accessibility|a11y/i },
  { name: 'browser_overlay', description: /Overlay|DOM Overlay/i },
];

for (const t of NEW_TOOLS) {
  test(`${t.name}: 导出完整 (name + description + parameters + execute)`, async () => {
    const mod = await import(`../../tools/${t.name}.js`);
    assert.ok(mod.name);
    assert.match(mod.description, t.description);
    assert.ok(mod.parameters);
    assert.equal(typeof mod.execute, 'function');
  });
}

// 参数校验
test('browser_security: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_security.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_security: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_security.js');
  const r = await mod.execute({ targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_security: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_security.js');
  const r = await mod.execute({ targetId: 'T', action: 'foo' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_service_worker: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_service_worker.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_service_worker: unregister 缺 origin → 快速失败', async () => {
  const mod = await import('../../tools/browser_service_worker.js');
  const r = await mod.execute({ action: 'unregister' });
  assert.equal(r.ok, false);
  assert.match(r.error, /origin required/);
});

test('browser_memory: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_memory.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_memory: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_memory.js');
  const r = await mod.execute({ targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_a11y: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_a11y.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_a11y: partial 缺 selector → 快速失败', async () => {
  const mod = await import('../../tools/browser_a11y.js');
  const r = await mod.execute({ targetId: 'T', action: 'partial' });
  assert.equal(r.ok, false);
  assert.match(r.error, /selector required/);
});

test('browser_overlay: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_overlay.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_overlay: highlight 缺 selector → 快速失败', async () => {
  const mod = await import('../../tools/browser_overlay.js');
  const r = await mod.execute({ targetId: 'T', action: 'highlight' });
  assert.equal(r.ok, false);
  assert.match(r.error, /selector required/);
});

// 未知 action
test('browser_security: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_security.js');
  const r = await mod.execute({ targetId: 'T', action: 'xyz' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_memory: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_memory.js');
  const r = await mod.execute({ targetId: 'T', action: 'xyz' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_a11y: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_a11y.js');
  const r = await mod.execute({ targetId: 'T', action: 'xyz' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_overlay: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_overlay.js');
  const r = await mod.execute({ targetId: 'T', action: 'xyz' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});