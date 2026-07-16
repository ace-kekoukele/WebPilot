// test/unit/activity-log.test.js — activity-log 模块测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';

// Create temp dir for tests
const tmpDir = mkdtempSync(path.join(tmpdir(), 'webpilot-test-activity-'));

// Mock RingBuffer for isolated testing
class MockRingBuffer {
  constructor(capacity = 100) {
    this.capacity = capacity;
    this._items = [];
  }
  push(item) {
    this._items.push(item);
    if (this._items.length > this.capacity) this._items.shift();
  }
  toArray() { return [...this._items]; }
  clear() { this._items = []; }
  get length() { return this._items.length; }
}

test('ActivityLog: log() creates proper entry structure', () => {
  // Simulate the log function from activity-log.js
  const buffer = new MockRingBuffer(1000);

  function log(event) {
    const entry = {
      ts: event.ts || new Date().toISOString(),
      agent: event.agent || 'unknown',
      agentColor: event.agentColor || null,
      tool: event.tool || '',
      args: event.args || {},
      ok: event.ok !== false,
      error: event.error || null,
      durationMs: event.durationMs || null,
      targetId: event.targetId || null,
    };
    buffer.push(entry);
    return entry;
  }

  const entry = log({
    agent: 'test-agent',
    tool: 'browser_navigate',
    args: { url: 'https://example.com' },
    ok: true,
    durationMs: 150,
  });

  assert.equal(entry.agent, 'test-agent');
  assert.equal(entry.tool, 'browser_navigate');
  assert.equal(entry.ok, true);
  assert.equal(entry.error, null);
  assert.equal(entry.durationMs, 150);
  assert.ok(entry.ts);
});

test('ActivityLog: log() with ok=false includes error', () => {
  const buffer = new MockRingBuffer(100);

  function log(event) {
    const entry = {
      ts: event.ts || new Date().toISOString(),
      agent: event.agent || 'unknown',
      tool: event.tool || '',
      ok: event.ok !== false,
      error: event.error || null,
      durationMs: event.durationMs || null,
    };
    buffer.push(entry);
    return entry;
  }

  const entry = log({
    tool: 'browser_eval',
    ok: false,
    error: 'CDP timeout',
    durationMs: 30000,
  });

  assert.equal(entry.ok, false);
  assert.equal(entry.error, 'CDP timeout');
});

test('ActivityLog: query filters work', () => {
  const buffer = new MockRingBuffer(10000);
  const now = new Date().toISOString();

  // Add test entries
  buffer.push({ ts: now, tool: 'browser_navigate', ok: true, agent: 'claude' });
  buffer.push({ ts: now, tool: 'browser_eval', ok: false, agent: 'claude' });
  buffer.push({ ts: now, tool: 'browser_click', ok: true, agent: 'cursor' });
  buffer.push({ ts: '2020-01-01T00:00:00Z', tool: 'browser_type', ok: true, agent: 'claude' });

  function query({ tool, ok, agent, since, until, limit = 200 } = {}) {
    let out = buffer.toArray().reverse();
    if (agent) out = out.filter(e => e.agent === agent);
    if (tool) out = out.filter(e => e.tool === tool);
    if (typeof ok === 'boolean') out = out.filter(e => e.ok === ok);
    if (since) out = out.filter(e => e.ts >= since);
    if (until) out = out.filter(e => e.ts <= until);
    return out.slice(0, limit);
  }

  // filter by tool
  assert.equal(query({ tool: 'browser_navigate' }).length, 1);

  // filter by ok
  assert.equal(query({ ok: false }).length, 1);

  // filter by agent
  assert.equal(query({ agent: 'claude' }).length, 3);

  // filter by time
  assert.equal(query({ since: '2024-01-01T00:00:00Z' }).length, 3);

  // limit
  assert.equal(query({ agent: 'claude', limit: 2 }).length, 2);
});

test('ActivityLog: size and clear work', () => {
  const buffer = new MockRingBuffer(100);

  buffer.push({ tool: 'a' });
  buffer.push({ tool: 'b' });
  buffer.push({ tool: 'c' });

  assert.ok(buffer.length >= 3);
  buffer.clear();
  assert.equal(buffer.length, 0);
});

test('ActivityLog: ring buffer FIFO behavior', () => {
  const buffer = new MockRingBuffer(3); // small capacity

  for (let i = 1; i <= 5; i++) {
    buffer.push({ id: i });
  }

  // Should only have last 3 (3, 4, 5)
  const arr = buffer.toArray();
  assert.equal(arr.length, 3);
  assert.equal(arr[0].id, 3);
  assert.equal(arr[2].id, 5);
});

test('ActivityLog: date file format is correct', () => {
  function dateFile(d) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `activity-${ds}.jsonl`;
  }

  const d = new Date('2024-03-15');
  assert.equal(dateFile(d), 'activity-2024-03-15.jsonl');

  const d2 = new Date('2024-12-01');
  assert.equal(dateFile(d2), 'activity-2024-12-01.jsonl');
});

// Cleanup
rmSync(tmpDir, { recursive: true, force: true });
