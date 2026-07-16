// test/unit/network-store.test.js — §3.5.2 网络逆向
// 每个测试**自己 new 一个 NetworkStore 实例**, 不走 singleton
// 防止跨测试文件并行时的状态污染
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('NetworkStore: query filters by method + URL pattern + status', async () => {
  const { NetworkStore } = await import('../../daemon/network-store.js');
  const store = new NetworkStore();   // fresh, no singleton pollution
  for (let i = 1; i <= 4; i++) {
    store._add({ requestId: `q${i}`, phase: 'request', method: i % 2 ? 'GET' : 'POST', url: `https://api.example.com/v${i}/data?p=${i}` });
    store._add({ requestId: `q${i}`, phase: 'response', status: i === 1 ? 404 : 200 });
  }
  assert.equal(store.query({ method: 'GET' }).length, 2);
  assert.equal(store.query({ urlPattern: 'v2' }).length, 1);
  assert.equal(store.query({ status: 404 }).length, 1);
  assert.equal(store.query({ method: 'POST', status: 200 }).length, 2);
});

test('NetworkStore: exportRequest returns merged fields', async () => {
  const { NetworkStore } = await import('../../daemon/network-store.js');
  const store = new NetworkStore();
  store._add({ requestId: 'er1', phase: 'request', method: 'PUT', url: 'https://x/y', headers: { 'X-A': 'a' }, postData: '{"k":1}' });
  store._add({ requestId: 'er1', phase: 'response', status: 201, responseBody: '{"ok":true}' });
  store._add({ requestId: 'er1', phase: 'finished', encodedDataLength: 12 });

  const out = store.exportRequest('er1');
  assert.equal(out.method, 'PUT');
  assert.equal(out.status, 201);
  assert.equal(out.url, 'https://x/y');
  assert.deepEqual(out.headers, { 'X-A': 'a' });
  assert.equal(out.postData, '{"k":1}');
  assert.equal(out.responseBody, '{"ok":true}');
});

test('NetworkStore: inferSchema on JSON response builds tree', async () => {
  const { NetworkStore } = await import('../../daemon/network-store.js');
  const store = new NetworkStore();
  const sample = {
    user: { id: 1, name: 'Alice', tags: ['a', 'b'] },
    items: [{ id: 1, title: 'x' }, { id: 2, title: 'y' }],
  };
  const id = 'sx1';
  store._add({ requestId: id, phase: 'request', method: 'GET', url: '/api/x' });
  store._add({ requestId: id, phase: 'response', status: 200, responseBody: JSON.stringify(sample) });

  const inferred = store.inferSchema(id);
  assert.ok(inferred);
  assert.equal(inferred.url, '/api/x');
  assert.match(inferred.schema, /user\.id: number/);
  assert.match(inferred.schema, /user\.name: string/);
  assert.match(inferred.schema, /items/);
  assert.match(inferred.schema, /length=2/);
});

test('NetworkStore: clear() wipes ring buffer', async () => {
  const { NetworkStore } = await import('../../daemon/network-store.js');
  const store = new NetworkStore();
  store._add({ requestId: 'cr1', phase: 'request', method: 'GET', url: '/x' });
  assert.ok(store.size() > 0);
  store.clear();
  assert.equal(store.size(), 0);
});
