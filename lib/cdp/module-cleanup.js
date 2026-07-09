// lib/cdp/module-cleanup.js — Tab 关闭清理 + 模块状态维护
// 解决工具里 module-level Map 永不清理导致的内存泄漏。
//
// 工作机制：
// 1. 订阅 CDP `Target.targetDestroyed` 事件
// 2. tabId 关闭 → 调所有注册的工具的 `_onTabClose(tabId)`
// 3. _ourTabs / _tabOrigin 也清掉对应条目
//
// §20 / §21 承诺：tab 关闭 → agent 状态完全清干净；user tab 永久不动。
//
// 这是 70 tools 8 步重构中的 Step 1 配套基础设施。
import { on } from './transport.js';

// ──── our tab tracking (Step 2-3 之后会更复杂) ────────────────────
// 现在用模块级 Set 直接记录「WebPilot 创建」的 tab。
// origin: 'agent'（我们 newTab 创建）｜ 'user'（用户已有的）
const _ourTabs = new Set();      // WebPilot 创建的 tabId
const _tabOrigin = new Map();     // 所有见过的 tabId → origin

export function isOurTab(targetId) {
  return _ourTabs.has(targetId);
}

export function getTabOrigin(targetId) {
  return _tabOrigin.get(targetId);
}

export function markOurTab(tabId) {
  _ourTabs.add(tabId);
  _tabOrigin.set(tabId, 'agent');
}

export function markUserTab(tabId) {
  _tabOrigin.set(tabId, 'user');
}

export function listOurTabs() {
  return Array.from(_ourTabs);
}

export function listAllTabsWithOrigin() {
  return Array.from(_tabOrigin.entries()).map(([id, origin]) => ({ id, origin }));
}

// ──── module cleanup registry ─────────────────────────────────────
// 工具声明 hook 后, daemon/main.js 启动时 installModuleCleanup()
const _onTabCloseHooks = new Set();
export function registerOnTabClose(hook) {
  _onTabCloseHooks.add(hook);
  return () => _onTabCloseHooks.delete(hook);
}

// 给所有工具加 hook
function callAllHooks(tabId) {
  for (const hook of _onTabCloseHooks) {
    try { hook(tabId); } catch (e) { /* 工具端 cleanup 失败不阻塞 */ }
  }
}

// 给定工具 module, 自动探测并注册 _onTabClose 导出
export async function registerToolCleanup(toolModule) {
  if (typeof toolModule._onTabClose === 'function') {
    return registerOnTabClose(toolModule._onTabClose);
  }
  return () => {}  // 该工具无 _onTabClose — 返回 unregister noop
}

// ──── 安装 CDP 事件订阅（由 daemon/main.js 调用）────────────────
let _installed = false;
export function installModuleCleanup() {
  if (_installed) return;
  _installed = true;

  on('Target.targetDestroyed', (params) => {
    const tabId = params?.targetId;
    if (!tabId) return;
    // 1. 清工具 Map
    callAllHooks(tabId);
    // 2. 清 our tab 跟踪
    _ourTabs.delete(tabId);
    _tabOrigin.delete(tabId);
  });

  // Page 关闭时 CDP 有时不上报 targetDestroyed（罕见）
  // 兜底：定时清理 _ourTabs 里的孤儿（ws 关闭+30s 后清理）
  setInterval(() => {
    // 占位 — Step 2 加 _sessionMap 检查后激活
  }, 30_000);
}

// ──── 内省（memory-guard 用） ─────────────────────────────────────
export function _stats() {
  let totalBytes = 0;
  for (const v of _tabOrigin.values()) {
    totalBytes += String(v).length;
  }
  return {
    module: 'cdp/module-cleanup',
    ourTabs: _ourTabs.size,
    tabOrigins: _tabOrigin.size,
    hooks: _onTabCloseHooks.size,
    originMapBytes: totalBytes,
  };
}

// ──── 测试用 ─────────────────────────────────────────────────────
export function _resetForTest() {
  _ourTabs.clear();
  _tabOrigin.clear();
  _onTabCloseHooks.clear();
  _installed = false;
}
