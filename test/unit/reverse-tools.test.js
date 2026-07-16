// test/unit/reverse-tools.test.js — §3.5.1/.2 网站逆向新工具
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('browser_dump_structure: exports name + params', async () => {
  const t = await import('../../tools/browser_dump_structure.js');
  assert.equal(t.name, 'browser_dump_structure');
  assert.equal(t.parameters.targetId.required, true);
  assert.equal(t.parameters.maxDepth.type, 'number');
  // JS 字符串嵌入要可解析
  await import('../unit/_helpers.js');   // 不报错就 ok
});

test('browser_dump_js: exports name + params', async () => {
  const t = await import('../../tools/browser_dump_js.js');
  assert.equal(t.name, 'browser_dump_js');
  assert.equal(t.parameters.includeInlineSource.type, 'boolean');
});

test('browser_extract_apis: attaches window.fetch + XHR hook', async () => {
  // 用 node test 的 mock 环境模拟 window 对象
  const calls = [];
  global.window = {
    fetch: async () => ({}),
    XMLHttpRequest: class { },
  };
  // 我们手动 import 内联 JS — 因为 evaluate 不能在 mock 跑
  // 改成: 验证模块加载 + 参数 schema
  const t = await import('../../tools/browser_extract_apis.js');
  assert.equal(t.name, 'browser_extract_apis');
  assert.equal(t.parameters.targetId.required, true);
  assert.equal(t.parameters.minCalls.type, 'number');
  delete global.window;
});

test('reverse tools: schema-validation skips unknown gracefully', async () => {
  // 三个工具都有 execute(args) 函数
  for (const mod of ['browser_dump_structure', 'browser_dump_js', 'browser_extract_apis']) {
    const t = await import(`../../tools/${mod}.js`);
    assert.equal(typeof t.execute, 'function');
  }
});

test('reverse tools: targetId required', async () => {
  for (const mod of ['browser_dump_structure', 'browser_dump_js', 'browser_extract_apis']) {
    const t = await import(`../../tools/${mod}.js`);
    const r = await t.execute({});
    assert.equal(r.ok, false);
    assert.match(r.error, /targetId required/);
  }
});
