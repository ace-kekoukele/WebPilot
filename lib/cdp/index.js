// lib/cdp/index.js — cdp 子模块 facade
// 让外部 import { xxx } from '../lib/cdp/index.js' 拿所有 cdp API

import { disconnect, ensureBridge } from './connection.js';
import {
  _send, _wireUpEvents, _openWs, _resetForTest, _setBrowserWsForTest, _registerSessionForTest,
  getBrowserWs, on, off, onSession, offSession, emit,
} from './transport.js';

// connection
export { ensureBridge, disconnect, isConnected, getState } from './connection.js';
export { _setBrowserWsForTest };
// send
export { sendCommand, sendPageCommand, navigate, evaluate, setEnabled, CircuitBreaker, cdpCircuitBreaker, CDPError, CDP_ERROR_CODES, isRetryableError } from './send.js';
// target
export { listTargets, listTabs, newTab, closeTab, getPageWsUrl } from './target.js';
// events / state (note: getState already exported above from connection.js)
export { on, off, onSession, offSession, emit };
// module-cleanup (70-tools 8-step refactor Step 1)
export {
  isOurTab, getTabOrigin, markOurTab, markUserTab,
  listOurTabs, listAllTabsWithOrigin,
  registerOnTabClose, registerToolCleanup,
  installModuleCleanup, _stats as _moduleCleanupStats,
  _resetForTest as _resetModuleCleanupForTest,
} from './module-cleanup.js';
// test hooks
export { _send, _wireUpEvents, _resetForTest, _registerSessionForTest };

// 兼容旧 _internal 导出 — 给旧测试用
export const _internal = {
  ensureBridge, _openWs, _send, _wireUpEvents,
  _resetForTest, _setBrowserWsForTest,
  _getBrowserWsForTest: getBrowserWs,
  _registerSessionForTest,
};

// shutdown handlers
process.on('SIGINT', () => { disconnect(); });
process.on('SIGTERM', () => { disconnect(); });