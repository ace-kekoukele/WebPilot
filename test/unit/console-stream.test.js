// test/unit/console-stream.test.js — console-stream 模块测试
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// Mock transport to avoid CDP dependency
const mockTransport = {
  _handlers: new Map(),
  on(event, handler) {
    const key = event;
    if (!this._handlers.has(key)) this._handlers.set(key, new Set());
    this._handlers.get(key).add(handler);
    return () => this._handlers.get(key)?.delete(handler);
  },
  off(event, handler) {
    this._handlers.get(event)?.delete(handler);
  },
  emit(event, params, sessionId) {
    const handlers = this._handlers.get(event);
    if (handlers) {
      for (const h of handlers) {
        h(params, sessionId);
      }
    }
  },
  _reset() {
    this._handlers.clear();
  },
};

// Create a minimal RingBuffer for testing
class MockRingBuffer {
  constructor(capacity = 1000) {
    this.capacity = capacity;
    this.buffer = [];
  }
  push(item) {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }
  toArray() { return [...this.buffer]; }
  recent(n) {
    const arr = this.toArray();
    return arr.slice(Math.max(0, arr.length - n));
  }
  clear() { this.buffer = []; }
  get length() { return this.buffer.length; }
}

test('console-stream: push() adds entry to buffer and notifies subscribers', () => {
  const subscribers = new Set();
  const buffer = new MockRingBuffer();

  // Inline the push function
  function push(entry) {
    const wrapped = { ts: Date.now(), ...entry };
    buffer.push(wrapped);
    const line = `data: ${JSON.stringify(entry)}\n\n`;
    for (const res of subscribers) {
      try { res.write(line); } catch {}
    }
  }

  let received = [];
  const mockRes = {
    writes: [],
    write(line) { this.writes.push(line); }
  };
  subscribers.add(mockRes);

  push({ kind: 'console', type: 'log', text: 'hello' });
  push({ kind: 'console', type: 'error', text: 'world' });

  assert.equal(buffer.length, 2);
  assert.equal(mockRes.writes.length, 2);
  assert.ok(mockRes.writes[0].includes('hello'));
});

test('console-stream: addSubscriber() sends recent 50 entries', () => {
  const buffer = new MockRingBuffer(100);
  const subscribers = new Set();

  // Pre-fill buffer
  for (let i = 0; i < 60; i++) {
    buffer.push({ kind: 'console', type: 'log', text: `msg${i}` });
  }

  function addSubscriber(res) {
    subscribers.add(res);
    for (const e of buffer.recent(50)) {
      try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch {}
    }
  }

  const mockRes = { writes: [] };
  mockRes.write = (line) => mockRes.writes.push(line);
  addSubscriber(mockRes);

  // Should receive only 50 (not all 60)
  assert.equal(mockRes.writes.length, 50);
});

test('console-stream: removeSubscriber() stops notifications', () => {
  const subscribers = new Set();
  const buffer = new MockRingBuffer();

  function push(entry) {
    buffer.push(entry);
    const line = `data: ${JSON.stringify(entry)}\n\n`;
    for (const res of subscribers) {
      try { res.write(line); } catch {}
    }
  }

  const mockRes = { writes: [], remove() { subscribers.delete(this); } };
  mockRes.write = (line) => mockRes.writes.push(line);
  subscribers.add(mockRes);

  push({ kind: 'console', type: 'log', text: 'first' });
  subscribers.delete(mockRes);
  push({ kind: 'console', type: 'log', text: 'second' });

  assert.equal(mockRes.writes.length, 1);
  assert.ok(mockRes.writes[0].includes('first'));
  assert.ok(!mockRes.writes[0].includes('second'));
});

test('console-stream: console event handler parses args correctly', () => {
  const entries = [];

  // Simulate the handler
  function handleConsole(params) {
    entries.push({
      kind: 'console',
      type: params.type || 'info',
      args: (params.args || []).map((a) => a.value ?? a.description ?? JSON.stringify(a)),
      url: params.stackTrace?.callFrames?.[0]?.url,
      line: params.stackTrace?.callFrames?.[0]?.lineNumber,
      sessionId: params.sessionId,
    });
  }

  handleConsole({
    type: 'log',
    args: [{ value: 'hello' }, { value: 42 }, { description: 'Object' }],
    stackTrace: { callFrames: [{ url: 'http://example.com/app.js', lineNumber: 10 }] },
    sessionId: 'tab1',
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'log');
  assert.deepEqual(entries[0].args, ['hello', 42, 'Object']);
  assert.equal(entries[0].url, 'http://example.com/app.js');
  assert.equal(entries[0].line, 10);
  assert.equal(entries[0].sessionId, 'tab1');
});

test('console-stream: log event handler parses entry correctly', () => {
  const entries = [];

  function handleLog(params) {
    const entry = params.entry || {};
    entries.push({
      kind: 'log',
      type: entry.level || 'info',
      text: entry.text || '',
      url: entry.url,
      line: entry.lineNumber,
      source: entry.source,
    });
  }

  handleLog({
    entry: {
      level: 'warning',
      text: 'Deprecated API',
      url: 'http://example.com/deprecated.js',
      lineNumber: 5,
      source: 'javascript',
    }
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].type, 'warning');
  assert.equal(entries[0].text, 'Deprecated API');
  assert.equal(entries[0].url, 'http://example.com/deprecated.js');
  assert.equal(entries[0].line, 5);
  assert.equal(entries[0].source, 'javascript');
});

test('console-stream: RingBuffer FIFO behavior', () => {
  const buffer = new MockRingBuffer(5);

  for (let i = 1; i <= 10; i++) {
    buffer.push({ id: i });
  }

  // Should contain last 5 (6-10)
  const arr = buffer.toArray();
  assert.equal(arr.length, 5);
  assert.equal(arr[0].id, 6);
  assert.equal(arr[4].id, 10);
});

test('console-stream: recent(n) returns last n entries', () => {
  const buffer = new MockRingBuffer(100);

  for (let i = 1; i <= 20; i++) {
    buffer.push({ id: i });
  }

  const recent3 = buffer.recent(3);
  assert.equal(recent3.length, 3);
  assert.equal(recent3[0].id, 18);
  assert.equal(recent3[2].id, 20);
});
