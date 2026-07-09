// test/unit/new-tools-v2.4.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

const TOOLS = [
  'browser_cache_storage',
  'browser_performance_metrics',
  'browser_js_heap_node',
  'browser_console_log',
];

for (const name of TOOLS) {
  test(`${name}: 导出完整`, async () => {
    const m = await import(`../../tools/${name}.js`);
    assert.ok(m.name);
    assert.ok(m.description);
    assert.ok(m.parameters);
    assert.equal(typeof m.execute, 'function');
  });
}

test('browser_cache_storage: 缺 action', async () => {
  const m = await import('../../tools/browser_cache_storage.js');
  assert.match((await m.execute({})).error, /action required/);
});

test('browser_cache_storage: list 缺 origin', async () => {
  const m = await import('../../tools/browser_cache_storage.js');
  assert.match((await m.execute({ action: 'list' })).error, /origin required/);
});

test('browser_cache_storage: entries 缺 cacheName', async () => {
  const m = await import('../../tools/browser_cache_storage.js');
  const r = await m.execute({ action: 'entries', origin: 'https://x' });
  assert.match(r.error, /cacheName required/);
});

test('browser_performance_metrics: 缺 targetId', async () => {
  const m = await import('../../tools/browser_performance_metrics.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_js_heap_node: 缺 snapshotPath', async () => {
  const m = await import('../../tools/browser_js_heap_node.js');
  assert.match((await m.execute({})).error, /snapshotPath required/);
});

test('browser_js_heap_node: 缺 objectId', async () => {
  const m = await import('../../tools/browser_js_heap_node.js');
  assert.match((await m.execute({ snapshotPath: 'x.heapsnapshot' })).error, /objectId required/);
});

test('browser_console_log: 缺 targetId', async () => {
  const m = await import('../../tools/browser_console_log.js');
  assert.equal((await m.execute({})).ok, false);
});