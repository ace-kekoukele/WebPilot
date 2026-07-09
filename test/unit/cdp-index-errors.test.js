// test/unit/cdp-index-errors.test.js — cdp 错误路径 + 状态机
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import * as cdp from '../../lib/cdp/index.js';
import { MockWs } from './_helpers.js';

const { _send, _wireUpEvents, _resetForTest, _setBrowserWsForTest, _getBrowserWsForTest, _registerSessionForTest } = cdp._internal;
const { sendPageCommand, sendCommand, evaluate, navigate, isConnected, disconnect } = cdp;

beforeEach(() => _resetForTest());
afterEach(async () => { try { await disconnect(); } catch {} });

// ──── sendPageCommand 错误路径 ────────────────────────────────────────
test('sendPageCommand: targetId 不在 sessionMap → CDPError', async () => {
  await assert.rejects(
    sendPageCommand('NOT_REGISTERED', 'Runtime.evaluate', { expression: '1' }),
    /CDPError/
  );
});

test('sendPageCommand: undefined targetId → CDPError', async () => {
  await assert.rejects(
    sendPageCommand(undefined, 'Runtime.evaluate', { expression: '1' }),
    /CDPError/
  );
});

test('evaluate: exceptionDetails 无 description → 默认 "JS exception"', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'EVAL_ERR_NO_DESC';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID_ERR', { ws, sessionId: sid, bucketKey: sid });
  const p = evaluate('TID_ERR', 'throw');
  ws.replyTo(0, { exceptionDetails: {} });
  const r = await p;
  assert.equal(r.error, 'JS exception');
  assert.equal(r.result, null);
});

test('evaluate: returnByValue: false opts 透传', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'EVAL_NORVAL';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID_NORVAL', { ws, sessionId: sid, bucketKey: sid });
  const p = evaluate('TID_NORVAL', 'x', { returnByValue: false });
  ws.replyTo(0, { result: { type: 'object' } });
  await p;
  assert.equal(ws.sent[0].params.returnByValue, false);
});

test('navigate: timeout 60s 默认', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'NAV_TO';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID_TO', { ws, sessionId: sid, bucketKey: sid });
  // navigate 内部硬编码 60000ms timeout — 这里只验证 method/url 透传
  const p = navigate('TID_TO', 'data:text/html,x');
  ws.replyTo(0, { frameId: 'F' });
  await p;
  assert.equal(ws.sent[0].method, 'Page.navigate');
  assert.equal(ws.sent[0].params.url, 'data:text/html,x');
});

test('sendPageCommand: session.bucketKey 与 _wireUpEvents sessionKey 一致', async () => {
  // 模拟 newTab 的 session 结构
  const ws = new MockWs(WebSocket.OPEN);
  const sessionId = 'SESS_X';
  _wireUpEvents(ws, sessionId);
  const bucketKey = sessionId;
  const p = _send(ws, null, bucketKey, 'Page.navigate', { url: 'about:blank' }, 1000, true);
  ws.replyTo(0, { frameId: 'F' });
  await p;
  assert.equal(ws.sent[0].method, 'Page.navigate');
});

// ──── evaluate 包装函数 ─────────────────────────────────────────────
test('evaluate: exceptionDetails → 返回 { error, result: null }', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'EVAL_ERR';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID1', { ws, sessionId: sid, bucketKey: sid });

  const p = evaluate('TID1', 'throw 1');
  ws.replyTo(0, { exceptionDetails: { exception: { description: 'Uncaught at line 1' } } });
  const r = await p;
  assert.equal(r.error, 'Uncaught at line 1');
  assert.equal(r.result, null);
});

test('evaluate: 正常返回值 → 返回 { result: r.result }', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'EVAL_OK';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID2', { ws, sessionId: sid, bucketKey: sid });

  const p = evaluate('TID2', '1+1');
  ws.replyTo(0, { result: { type: 'number', value: 2 } });
  const r = await p;
  assert.deepEqual(r.result, { type: 'number', value: 2 });
});

test('evaluate: opts 默认值正确 (awaitPromise/returnByValue/userGesture)', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'EVAL_DEFAULTS';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID3', { ws, sessionId: sid, bucketKey: sid });

  const p = evaluate('TID3', 'x');
  ws.replyTo(0, { result: {} });
  await p;
  const params = ws.sent[0].params;
  assert.equal(params.expression, 'x');
  assert.equal(params.returnByValue, true);
  assert.equal(params.awaitPromise, true);
  assert.equal(params.userGesture, true);
  assert.equal(params.timeout, 0);
});

test('navigate: sendPageCommand 包装 (url 透传)', async () => {
  const ws = new MockWs(WebSocket.OPEN);
  const sid = 'NAV';
  _wireUpEvents(ws, sid);
  cdp._internal._registerSessionForTest('TID_NAV', { ws, sessionId: sid, bucketKey: sid });

  const p = navigate('TID_NAV', 'https://example.com');
  ws.replyTo(0, { frameId: 'F1' });
  const r = await p;
  assert.equal(ws.sent[0].method, 'Page.navigate');
  assert.equal(ws.sent[0].params.url, 'https://example.com');
  assert.equal(r.frameId, 'F1');
});

// ──── isConnected / disconnect 状态 ────────────────────────────────
test('isConnected: 无 _browserWs → false', () => {
  _resetForTest();
  assert.equal(isConnected(), false);
});

test('isConnected: _browserWs 已 OPEN → true', () => {
  const ws = new MockWs(WebSocket.OPEN);
  cdp._internal._setBrowserWsForTest(ws);
  assert.equal(isConnected(), true);
});

test('isConnected: _browserWs 已 CLOSED → false', () => {
  const ws = new MockWs(WebSocket.CLOSED);
  cdp._internal._setBrowserWsForTest(ws);
  assert.equal(isConnected(), false);
});

test('disconnect: 清空 _browserWs + _sessionMap', async () => {
  const ws1 = new MockWs(WebSocket.OPEN);
  const ws2 = new MockWs(WebSocket.OPEN);
  cdp._internal._setBrowserWsForTest(ws1);
  cdp._internal._registerSessionForTest('TID_DC1', { ws: ws2, sessionId: 'S1', bucketKey: 'S1' });
  await disconnect();
  assert.equal(cdp._internal._getBrowserWsForTest(), null);
  assert.equal(ws2.readyState, WebSocket.CLOSED);
});

// ──── 并发 / race condition ──────────────────────────────────────────
test('sendPageCommand 并发 5 个不同 target → 独立 bucket, 互不干扰', async () => {
  const targets = ['T1', 'T2', 'T3', 'T4', 'T5'];
  const wss = targets.map(t => {
    const w = new MockWs(WebSocket.OPEN);
    _wireUpEvents(w, `page:${t}`);
    cdp._internal._registerSessionForTest(t, { ws: w, sessionId: null, bucketKey: `page:${t}` });
    return w;
  });

  const ps = targets.map((t, i) => sendPageCommand(t, 'Runtime.evaluate', { expression: String(i) }));
  // 乱序回复
  wss[3].replyTo(0, { which: 3 });
  wss[0].replyTo(0, { which: 0 });
  wss[4].replyTo(0, { which: 4 });
  wss[1].replyTo(0, { which: 1 });
  wss[2].replyTo(0, { which: 2 });

  const results = await Promise.all(ps);
  assert.deepEqual(results.map(r => r.which), [0, 1, 2, 3, 4]);
});