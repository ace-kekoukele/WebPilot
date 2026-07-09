// test/unit/new-tools-v2.5.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

const TOOLS = [
  'browser_fetch',
  'browser_request_blocking',
  'browser_dom_breakpoint',
  'browser_audit_full',
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

test('browser_fetch: 缺 targetId', async () => {
  const m = await import('../../tools/browser_fetch.js');
  assert.equal((await m.execute({})).ok, false);
});

test('browser_fetch: 缺 action', async () => {
  const m = await import('../../tools/browser_fetch.js');
  assert.match((await m.execute({ targetId: 'T' })).error, /action required/);
});

test('browser_fetch: enable 缺 urlPattern', async () => {
  const m = await import('../../tools/browser_fetch.js');
  assert.match((await m.execute({ targetId: 'T', action: 'enable' })).error, /urlPattern required/);
});

test('browser_request_blocking: enable 缺 urlPatterns', async () => {
  const m = await import('../../tools/browser_request_blocking.js');
  const r = await m.execute({ targetId: 'T', action: 'enable' });
  assert.match(r.error, /urlPatterns/);
});

test('browser_request_blocking: enable 空数组', async () => {
  const m = await import('../../tools/browser_request_blocking.js');
  const r = await m.execute({ targetId: 'T', action: 'enable', urlPatterns: [] });
  assert.match(r.error, /urlPatterns/);
});

test('browser_dom_breakpoint: setSubtree 缺 selector', async () => {
  const m = await import('../../tools/browser_dom_breakpoint.js');
  assert.match((await m.execute({ targetId: 'T', action: 'setSubtree' })).error, /selector required/);
});

test('browser_dom_breakpoint: setAttribute 缺 attributeName', async () => {
  const m = await import('../../tools/browser_dom_breakpoint.js');
  const r = await m.execute({ targetId: 'T', action: 'setAttribute', selector: 'div' });
  assert.match(r.error, /attributeName required/);
});

test('browser_audit_full: 缺 targetId', async () => {
  const m = await import('../../tools/browser_audit_full.js');
  assert.equal((await m.execute({})).ok, false);
});