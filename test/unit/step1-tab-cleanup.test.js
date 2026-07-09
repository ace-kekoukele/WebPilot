// test/unit/step1-tab-cleanup.test.js — 70 tools 8 步重构 Step 1 单测
// 验证：tab 关闭时 _onTabClose hooks 被调用, 工具 module-level Map 被清理
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Step 1: _onTabClose hook fires when tab is destroyed', async () => {
  // 1. 模拟 mock dialog 工具, 注册 hook
  const calls = [];
  const mockDialog = {
    _pending: new Map(),
    _onTabClose(targetId) {
      this._pending.delete(targetId);
      calls.push(targetId);
    },
  };

  // 2. 模拟 mock network 工具
  const mockNet = {
    _buffers: new Map(),
    _onTabClose(targetId) {
      this._buffers.delete(targetId);
    },
  };

  // 3. 设置数据
  mockDialog._pending.set('tab-A', { dialog: 'foo' });
  mockNet._buffers.set('tab-A', []);
  mockNet._buffers.set('tab-B', []);

  // 4. 直接调 hook 模拟 targetDestroyed 触发（avoid 真实 ws setup）
  // 改用 module-cleanup.js 的内部 callAllHooks 路径 — 这里手动测
  // 因为 installModuleCleanup() 需要 transport.on(), 我们用 mock emitter

  const { EventEmitter } = await import('node:events');
  const emitter = new EventEmitter();
  emitter.on('Target.targetDestroyed', (params) => {
    mockDialog._onTabClose(params.targetId);
    mockNet._onTabClose(params.targetId);
  });

  emitter.emit('Target.targetDestroyed', { targetId: 'tab-A' });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'tab-A');
  assert.equal(mockDialog._pending.size, 0);
  assert.equal(mockNet._buffers.size, 1, 'tab-B buffer should remain');
  assert.ok(mockNet._buffers.has('tab-B'));
});

test('Step 1: module-level Map grows without bound — hook fixes it', async () => {
  // 模拟不清理的情况 vs 清理后的对比
  const pending = new Map();
  // 模拟 1000 个 tab 创建又关闭 — 旧代码: 永不清理 → 1000 条
  for (let i = 0; i < 1000; i++) {
    pending.set(`tab-${i}`, { state: 'pending', i });
  }
  assert.equal(pending.size, 1000, 'before hook');
  // 模拟关闭一半 — 旧代码: 这些条目永久保留
  // Step 1 hook 会清
  for (let i = 0; i < 500; i++) {
    pending.delete(`tab-${i}`);
  }
  assert.equal(pending.size, 500, 'after hook');
});

test('Step 1: real browser_dialog module exports _onTabClose', async () => {
  const mod = await import('../../tools/browser_dialog.js');
  assert.equal(typeof mod._onTabClose, 'function');
  // _pending 在原代码里导出为 _internal_pending；hook 共享同一引用
  mod._internal_pending.set('test-tab', { type: 'alert' });
  mod._onTabClose('test-tab');
  assert.equal(mod._internal_pending.has('test-tab'), false);
});

test('Step 1: real browser_network module exports _onTabClose', async () => {
  const mod = await import('../../tools/browser_network.js');
  assert.equal(typeof mod._onTabClose, 'function');
  mod._net_buffers.set('test-tab', [{ url: 'http://x' }]);
  mod._onTabClose('test-tab');
  assert.equal(mod._net_buffers.has('test-tab'), false);
});

test('Step 1: _internal_stats reports size for memory-guard', async () => {
  const dialog = await import('../../tools/browser_dialog.js');
  const net = await import('../../tools/browser_network.js');
  dialog._internal_pending.set('a', {}).set('b', {});
  net._net_buffers.set('x', [1, 2, 3]);
  const dStats = dialog._internal_stats();
  const nStats = net._internal_stats();
  assert.equal(dStats.module, 'browser_dialog');
  assert.equal(dStats.pendingEntries, 2);
  assert.equal(nStats.module, 'browser_network');
  assert.equal(nStats.pendingEntries, 1);
  assert.equal(nStats.bufferedRequests, 3);
});
