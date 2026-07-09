// daemon/memory-guard.js — 内存 / 句柄监控 + 警告
//
// 每 60s 收集:
//   - process.memoryUsage() (rss, heapUsed, external)
//   - process.report.getReport().libuv[0].fd_count  (句柄数, Node 22+)
//   - lib/cdp/module-cleanup.js _stats()
//   - 所有注册 module 的 _internal_stats()
//
// 阈值:
//   - RSS > 500 MB → info
//   - RSS > 1 GB   → warn
//   - handle count > 5000 → warn
//   - any module stats.pendingEntries > 1000 → warn
import { getLogger } from './logger.js';
import { _stats as moduleCleanupStats } from '../lib/cdp/module-cleanup.js';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.join(__dirname, '..', 'tools');

const WARN_RSS_MB = 1024;
const WARN_FD = 5000;
const WARN_PENDING_ENTRIES = 1000;
const WARN_MAX_MODULES = 300;

let _tick = null;
let _registeredModules = [];

export async function registerAllToolModules() {
  // 动态 import 所有 tools/* 模块, 收集 _internal_stats()
  let files;
  try { files = readdirSync(TOOLS_DIR); } catch { return; }
  const modules = [];
  for (const f of files) {
    if (!/^browser_.+\.js$/.test(f)) continue;
    try {
      const m = await import(path.join(TOOLS_DIR, f));
      if (typeof m._internal_stats === 'function') {
        _registeredModules.push({ name: f.replace(/\.js$/, ''), stats: m._internal_stats });
      }
    } catch {}
  }
}

export function startMemoryGuard() {
  if (_tick) return;
  // 注册所有 tools module 的 stats collector (异步, fire-and-forget)
  registerAllToolModules().catch(() => {});

  _tick = setInterval(() => {
    try {
      const log = getLogger().child({ module: 'memory-guard' });
      const mem = process.memoryUsage();
      const rssMB = Math.round(mem.rss / 1024 / 1024);

      // FD 计数 (libuv 在 [0])
      let fd = null;
      try {
        const report = process.report.getReport();
        const libuv = Array.isArray(report?.libuv) ? report.libuv[0] : null;
        fd = libuv?.fd_count ?? null;
      } catch {}

      // 收集模块 stats
      const modStats = [];
      for (const m of _registeredModules) {
        try { modStats.push({ name: m.name, ...m.stats() }); } catch {}
      }

      const report2 = {
        rssMB,
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        fd,
        moduleCleanup: moduleCleanupStats(),
        modules: modStats,
        moduleCount: _registeredModules.length,
      };

      if (rssMB > WARN_RSS_MB) {
        log.warn(`内存高: RSS=${rssMB}MB`, report2);
      } else if (fd !== null && fd > WARN_FD) {
        log.warn(`句柄数高: ${fd}`, report2);
      } else if (_registeredModules.length > WARN_MAX_MODULES) {
        log.warn(`模块数过多: ${_registeredModules.length}`, report2);
      } else {
        log.debug(`健康 rss=${rssMB}MB fd=${fd}`, report2);
      }

      // 检查 pendingEntries 警告
      for (const m of modStats) {
        if (m.pendingEntries > WARN_PENDING_ENTRIES) {
          log.warn(`模块 ${m.name} pendingEntries=${m.pendingEntries}`, m);
        }
      }
    } catch (e) {
      // 静默
    }
  }, 60_000);
  // 立即检查一次
  setTimeout(() => {
    try {
      const mem = process.memoryUsage();
      const log = getLogger().child({ module: 'memory-guard' });
      log.debug('memory-guard started', { rssMB: Math.round(mem.rss / 1024 / 1024) });
    } catch {}
  }, 100);
}

export function stopMemoryGuard() {
  if (_tick) clearInterval(_tick);
  _tick = null;
}

export function getRegisteredCount() {
  return _registeredModules.length;
}
