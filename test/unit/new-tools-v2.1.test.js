// test/unit/new-tools-v2.1.test.js — Chrome 150 新工具测试 (5 个)
// 不依赖 Chrome: 只测参数校验 + 工具导出完整性
import { test } from 'node:test';
import assert from 'node:assert/strict';

const NEW_TOOLS = [
  { name: 'browser_storage', description: /Storage/i },
  { name: 'browser_audits', description: /审计|Audits|Performance/i },
  { name: 'browser_css', description: /CSS/i },
  { name: 'browser_animation', description: /动画|Animation/i },
  { name: 'browser_tracing', description: /trace|Tracing/i },
];

for (const t of NEW_TOOLS) {
  test(`browser_${t.name}: 导出完整 (name + description + parameters + execute)`, async () => {
    const mod = await import(`../../tools/${t.name}.js`);
    assert.ok(mod.name, 'missing name');
    assert.match(mod.description, t.description);
    assert.ok(mod.parameters, 'missing parameters');
    assert.equal(typeof mod.execute, 'function');
  });
}

// 参数缺失快速失败测试
test('browser_storage: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_storage.js');
  const r = await mod.execute({ targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_storage: quota 不需要 targetId (代码静态分析)', async () => {
  // quota 不需要 targetId: 通过读源码第一行判断, 不实际执行避免真连 Chrome
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(__dirname, '../../tools/browser_storage.js'), 'utf8');
  // quota 分支必须在 targetId 检查之前
  const quotaIdx = src.indexOf("args.action === 'quota'");
  const targetIdIdx = src.indexOf("'targetId required'");
  assert.ok(quotaIdx > 0, 'quota 分支存在');
  assert.ok(targetIdIdx > quotaIdx, 'targetId 校验在 quota 之后 (即 quota 不需要 targetId)');
});

test('browser_storage: 非 quota 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_storage.js');
  const r = await mod.execute({ action: 'list' });
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_audits: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_audits.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_css: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_css.js');
  const r = await mod.execute({ targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_css: getComputed 缺 selector → 快速失败', async () => {
  const mod = await import('../../tools/browser_css.js');
  const r = await mod.execute({ targetId: 'T', action: 'getComputed' });
  assert.equal(r.ok, false);
  assert.match(r.error, /selector required/);
});

test('browser_animation: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_animation.js');
  const r = await mod.execute({ targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_tracing: 缺 action → 快速失败', async () => {
  const mod = await import('../../tools/browser_tracing.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

// 未知 action 错误处理
test('browser_storage: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_storage.js');
  const r = await mod.execute({ action: 'foo', targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_animation: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_animation.js');
  const r = await mod.execute({ action: 'foo', targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_tracing: 未知 action → unknown action', async () => {
  const mod = await import('../../tools/browser_tracing.js');
  const r = await mod.execute({ action: 'foo' });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown action/);
});

test('browser_storage: indexeddb clear 缺 origin → 错误', async () => {
  const mod = await import('../../tools/browser_storage.js');
  const r = await mod.execute({ action: 'clear', type: 'indexeddb', targetId: 'T' });
  assert.equal(r.ok, false);
  assert.match(r.error, /origin required/);
});