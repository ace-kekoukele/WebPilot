// test/unit/new-tools-v2.3.test.js — Chrome 150 新工具 v2.3 测试
import { test } from 'node:test';
import assert from 'node:assert/strict';

const TOOLS = [
  'browser_dom_snapshot',
  'browser_layer_tree',
  'browser_headless',
  'browser_indexeddb',
  'browser_css_coverage',
];

for (const name of TOOLS) {
  test(`${name}: 导出完整`, async () => {
    const mod = await import(`../../tools/${name}.js`);
    assert.ok(mod.name);
    assert.ok(mod.description);
    assert.ok(mod.parameters);
    assert.equal(typeof mod.execute, 'function');
  });
}

test('browser_dom_snapshot: 缺 targetId', async () => {
  const m = await import('../../tools/browser_dom_snapshot.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_layer_tree: 缺 targetId', async () => {
  const m = await import('../../tools/browser_layer_tree.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_headless: 缺 action', async () => {
  const m = await import('../../tools/browser_headless.js');
  const r = await m.execute({});
  assert.equal(r.ok, false);
  assert.match(r.error, /action required/);
});

test('browser_headless: 未知 action', async () => {
  const m = await import('../../tools/browser_headless.js');
  const r = await m.execute({ action: 'foo' });
  assert.match(r.error, /unknown action/);
});

test('browser_indexeddb: 缺 targetId', async () => {
  const m = await import('../../tools/browser_indexeddb.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_indexeddb: 缺 action', async () => {
  const m = await import('../../tools/browser_indexeddb.js');
  assert.match((await m.execute({ targetId: 'T' })).error, /action required/);
});

test('browser_indexeddb: listObjectStores 缺 dbName', async () => {
  const m = await import('../../tools/browser_indexeddb.js');
  assert.match((await m.execute({ targetId: 'T', action: 'listObjectStores' })).error, /dbName required/);
});

test('browser_indexeddb: getAll 缺 dbName+storeName', async () => {
  const m = await import('../../tools/browser_indexeddb.js');
  const r = await m.execute({ targetId: 'T', action: 'getAll' });
  assert.match(r.error, /dbName \+ storeName required/);
});

test('browser_css_coverage: 缺 targetId', async () => {
  const m = await import('../../tools/browser_css_coverage.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_css_coverage: 缺 action', async () => {
  const m = await import('../../tools/browser_css_coverage.js');
  assert.match((await m.execute({ targetId: 'T' })).error, /action required/);
});