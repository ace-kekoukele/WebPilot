// test/unit/tools-args-validation.test.js — 工具层参数快速失败测试
// 不依赖 Chrome:这些工具在参数缺失时直接返回,不会调到 cdp-manager。
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ─── browser_close_tab ─────────────────────────────────────────────────
test('browser_close_tab: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_close_tab.js');
  const r = await mod.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

// ─── browser_navigate ──────────────────────────────────────────────────
test('browser_navigate: 缺 targetId → 快速失败', async () => {
  const mod = await import('../../tools/browser_navigate.js');
  const r = await mod.execute({ url: 'https://example.com' });
  assert.equal(r.ok, false);
  assert.match(r.error, /targetId required/);
});

test('browser_navigate: 缺 url → 快速失败', async () => {
  const mod = await import('../../tools/browser_navigate.js');
  const r = await mod.execute({ targetId: 'T1' });
  assert.equal(r.ok, false);
  assert.match(r.error, /url required/);
});

// ─── browser_press_key ─────────────────────────────────────────────────
test('browser_press_key: 缺 key → 快速失败', async () => {
  const mod = await import('../../tools/browser_press_key.js');
  const r = await mod.execute({ targetId: 'T1' });
  assert.equal(r.ok, false);
  assert.match(r.error, /key required/);
});

// ─── browser_upload ────────────────────────────────────────────────────
test('browser_upload: 缺 filePath → 快速失败', async () => {
  const mod = await import('../../tools/browser_upload.js');
  const r = await mod.execute({ targetId: 'T1', selector: 'input' });
  assert.equal(r.ok, false);
  assert.match(r.error, /filePath required/);
});

test('browser_upload: 缺 selector → 快速失败', async () => {
  const mod = await import('../../tools/browser_upload.js');
  const r = await mod.execute({ targetId: 'T1', filePath: 'C:/x' });
  assert.equal(r.ok, false);
  assert.match(r.error, /selector required/);
});

// ─── 所有 tool 的 name/description/parameters 字段齐全 ──────────────────
test('tools: 所有 tools 都导出 name + description + parameters + execute', async () => {
  const { readdirSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const toolsDir = join(__dirname, '..', '..', 'tools');
  const files = readdirSync(toolsDir).filter(f => f.startsWith('browser_') && f.endsWith('.js'));
  assert.ok(files.length >= 40, `期望至少 40 个工具,实际 ${files.length}`);
  let checked = 0;
  for (const f of files) {
    const mod = await import(`../../tools/${f}`);
    assert.ok(mod.name, `${f}: missing name`);
    assert.ok(mod.description, `${f}: missing description`);
    assert.ok(mod.parameters, `${f}: missing parameters`);
    assert.equal(typeof mod.execute, 'function', `${f}: execute not function`);
    checked++;
  }
  assert.ok(checked >= 40);
});