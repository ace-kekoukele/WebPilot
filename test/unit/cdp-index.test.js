// test/unit/cdp-index.test.js — 单元测试: _send + _wireUpEvents (P0 修复保护)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { _internal } from '../../lib/cdp/index.js';
import { MockWs } from './_helpers.js';

const { _send, _wireUpEvents, _resetForTest } = _internal;

beforeEach(() => _resetForTest());

test('_send: page ws NEVER embeds sessionId field (Chrome 124+ P0 regression)', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, 'page:ABC');
  const p = _send(ws, null, 'page:ABC', 'Page.navigate', { url: 'data:text/html,x' }, 1000, true);
  ws.replyTo(0, { frameId: 'F1' });
  const result = await p;
  assert.equal(result.frameId, 'F1');
  const sent = ws.sent[0];
  assert.equal(sent.method, 'Page.navigate');
  assert.ok(!('sessionId' in sent), 'page ws must NOT embed sessionId field — P0 regression check');
});

test('_send: Browser-level command also has no sessionId field', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, '_browser');
  const p = _send(ws, null, '_browser', 'Target.createTarget', { url: 'about:blank' }, 1000, false);
  ws.replyTo(0, { targetId: 'T1' });
  const r = await p;
  assert.equal(r.targetId, 'T1');
  assert.ok(!('sessionId' in ws.sent[0]));
});

test('_send: explicit cdpSessionId DOES embed (functionality preserved)', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, 'SESS123');
  const p = _send(ws, 'SESS123', 'SESS123', 'Runtime.evaluate', { expression: '1' }, 1000, false);
  ws.replyTo(0, { result: {} });
  await p;
  assert.equal(ws.sent[0].sessionId, 'SESS123');
});

test('_send: separate page sessions route responses independently', async () => {
  const ws1 = new MockWs(WebSocket.OPEN);
  const ws2 = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws1, 'page:T1');
  _wireUpEvents(ws2, 'page:T2');
  const p1 = _send(ws1, null, 'page:T1', 'Page.navigate', { url: 'u1' }, 1000, true);
  const p2 = _send(ws2, null, 'page:T2', 'Page.navigate', { url: 'u2' }, 1000, true);
  // T2 replies first
  ws2.replyTo(0, { frameId: 'F2' });
  ws1.replyTo(0, { frameId: 'F1' });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.frameId, 'F1');
  assert.equal(r2.frameId, 'F2');
  assert.notEqual(ws1.sent[0].id, ws2.sent[0].id, 'IDs are independently generated per send');
});

test('_send: closed ws rejects with "ws not open"', async () => {
  const ws = new MockWs(WebSocket.CLOSED);
  await assert.rejects(
    _send(ws, null, '_browser', 'Target.createTarget', {}, 1000, false),
    /ws not open/
  );
  assert.equal(ws.sent.length, 0);
});

test('_send: timeout rejects with method + ms, cleans up bucket', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, '_browser');
  await assert.rejects(
    _send(ws, null, '_browser', 'Slow.method', {}, 50, false),
    /Slow\.method timeout 50ms/
  );
  assert.equal(ws.sent.length, 1);
});

test('_send: CDP error response rejects with error message', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, '_browser');
  const p = _send(ws, null, '_browser', 'Bad.method', {}, 1000, false);
  ws.replyErrorTo(0, 'no permission');
  await assert.rejects(p, /no permission/);
});

test('_send: 多个 in-flight 按 ID 乱序 reply 仍正确路由', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, '_browser');
  const p1 = _send(ws, null, '_browser', 'A', {}, 1000, false);
  const p2 = _send(ws, null, '_browser', 'B', {}, 1000, false);
  const p3 = _send(ws, null, '_browser', 'C', {}, 1000, false);
  // 乱序: 2, 3, 1
  ws.replyTo(1, { which: 'B' });
  ws.replyTo(2, { which: 'C' });
  ws.replyTo(0, { which: 'A' });
  const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
  assert.deepEqual([r1.which, r2.which, r3.which], ['A', 'B', 'C']);
  assert.deepEqual(ws.sent.map(s => s.id), [1, 2, 3]);
});

test('_wireUpEvents: ws close rejects all pending in that bucket', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, 'page:X');
  const p = _send(ws, null, 'page:X', 'Page.navigate', { url: 'u' }, 5000, true);
  ws.close();
  await assert.rejects(p, /ws closed/);
});

test('_send: 参数 params undefined 走默认空对象', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  _wireUpEvents(ws, '_browser');
  const p = _send(ws, null, '_browser', 'Target.createTarget', undefined, 1000, false);
  ws.replyTo(0, { targetId: 'T' });
  await p;
  assert.deepEqual(ws.sent[0].params, {});
});