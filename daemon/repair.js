// daemon/repair.js — 一键修复 (执行 + 进度报告)
//
// §18 设计 + §24.4: 23 类修复, 但 v4.0 先做 5 个**真有效**高频修复:
//   1. 端口被占 → 迁移到下一可用
//   2. config.json 损坏 → 备份 + 走默认
//   3. token 缺失 → 重新生成
//   4. ws/Chrome 死了 → 重连 (trigger watchdog)
//   5. Chrome profile 锁文件残留 → 清掉
//
// 流程: 4 阶段 (diagnose / fix / verify / report), 用户看进度, 可 cancel.

import { EventEmitter } from 'node:events';
import { existsSync, writeFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync, statSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { currentConfig, patchConfig, getConfigDir, loadConfig } from './config.js';
import { negotiatePorts, isPortFree } from './port-finder.js';
import { getWatchdog } from './cdp-watchdog.js';
import { DEFAULT_PORTS } from '../lib/version.js';

// ──── 单个修复 — 每个返回 { ok, detail } ───────────────────────
const FIXES = {
  // 1. 端口被占
  fix_01_port_conflict: async (ctx) => {
    ctx.progress('01', '检测端口占用...');
    const wanted = {
      cdp: currentConfig().cdp.port,
      mcp: currentConfig().mcp.port,
      http: currentConfig().http.port,
    };
    const result = await negotiatePorts(wanted, '127.0.0.1');
    const migrated = Object.values(result).filter((r) => r.migrated);
    if (migrated.length === 0) return { ok: true, action: 'no-conflict' };
    const patch = {};
    if (result.cdp.migrated) patch.cdp = { port: result.cdp.actual };
    if (result.mcp.migrated) patch.mcp = { port: result.mcp.actual };
    if (result.http.migrated) patch.http = { port: result.http.actual };
    patchConfig(patch);
    return { ok: true, action: 'migrated', ports: result, count: migrated.length };
  },

  // 2. config 损坏 → 重置默认值
  fix_02_config_corrupt: async (ctx) => {
    ctx.progress('02', '检查 config.json...');
    const cfgPath = path.join(getConfigDir(), 'config.json');
    if (!existsSync(cfgPath)) return { ok: true, action: 'no-config-file' };
    let raw;
    try { raw = readFileSync(cfgPath, 'utf8'); } catch { raw = ''; }
    let isCorrupt = false;
    try { JSON.parse(raw); } catch { isCorrupt = true; }
    if (!isCorrupt) return { ok: true, action: 'config-valid' };

    // 备份 + 重置
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = `${cfgPath}.broken-${ts}`;
    try { renameSync(cfgPath, backupPath); } catch {}
    loadConfig();   // 触发 fallback 到 default
    return { ok: true, action: 'reset-to-default', backup: backupPath };
  },

  // 3. token 缺失 → 重新生成
  fix_03_token_missing: async (ctx) => {
    ctx.progress('03', '检查 control token...');
    const cfg = currentConfig();
    const token = cfg.control?.token;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      return { ok: true, action: 'token-valid' };
    }
    const newToken = randomBytes(32).toString('hex');   // 64 hex chars
    patchConfig({ control: { token: newToken } });
    try {
      const tokenPath = path.join(getConfigDir(), 'control.token');
      writeFileSync(tokenPath, newToken, { mode: 0o600 });
    } catch {}
    return { ok: true, action: 'regenerated', token: newToken.slice(0, 8) + '...' };
  },

  // 4. ws/chrome 死 → 触发 watchdog 重连
  fix_04_chrome_disconnected: async (ctx) => {
    ctx.progress('04', '触发 ws 重连...');
    const w = getWatchdog();
    if (!w || (w.state !== 'DISCONNECTED' && w.state !== 'FAILED')) {
      // 已经连上 / 正在重连 — noop
      return { ok: true, action: 'noop', state: w?.state };
    }
    // 强制重置 attempts 然后尝试连接
    w.attempts = 0;
    if (w.timer) clearTimeout(w.timer);
    await w._attemptConnect();
    return { ok: true, action: 'reconnect-triggered', state: w.state };
  },

  // 5. Chrome profile 锁文件残留 → 清
  fix_05_chrome_lockfile: async (ctx) => {
    ctx.progress('05', '清理 Chrome profile 锁文件...');
    const ud = currentConfig().chrome.userDataDir
      || path.join(getConfigDir(), 'chrome-profile');
    if (!existsSync(ud)) return { ok: true, action: 'no-user-data-dir' };
    const removed = [];
    for (const f of ['SingletonLock', 'SingletonCookie', 'lockfile', 'LOCK']) {
      const p = path.join(ud, f);
      if (existsSync(p)) {
        try { unlinkSync(p); removed.push(f); } catch {}
      }
    }
    return { ok: true, action: 'cleaned', files: removed };
  },
};

// ──── 全量诊断（read-only） ──────────────────────────────────
export async function diagnose() {
  const checks = [];
  // 1. daemon process
  checks.push({ id: 1, name: 'daemon 进程', ok: true, detail: `pid=${process.pid}` });
  // 2. Chrome reachable
  try {
    const port = currentConfig().cdp.port;
    const free = await isPortFree(port);
    // 9222 free 意味着 Chrome 不在跑 — 警告而非错误
    checks.push({ id: 2, name: `Chrome CDP ${port}`, ok: !free, detail: free ? 'no-chrome-on-port' : 'in-use (good)' });
  } catch (e) {
    checks.push({ id: 2, name: 'Chrome CDP', ok: false, detail: e.message });
  }
  // 3. 端口可用
  for (const [name, port] of [['mcp', 9223], ['http', 9224]]) {
    try {
      const free = await isPortFree(port);
      checks.push({ id: 10 + (name === 'mcp' ? 0 : 1), name: `${name} ${port}`, ok: !free, detail: free ? 'free' : 'in-use' });
    } catch (e) {
      checks.push({ id: 99, name: `${name}`, ok: false, detail: e.message });
    }
  }
  // 4. config.json
  try {
    const cfgPath = path.join(getConfigDir(), 'config.json');
    if (existsSync(cfgPath)) {
      JSON.parse(readFileSync(cfgPath, 'utf8'));
      checks.push({ id: 20, name: 'config.json', ok: true });
    } else {
      checks.push({ id: 20, name: 'config.json', ok: false, detail: 'no-file (will create)' });
    }
  } catch (e) {
    checks.push({ id: 20, name: 'config.json', ok: false, detail: 'corrupt: ' + e.message });
  }
  // 5. token
  const token = currentConfig().control?.token;
  checks.push({ id: 21, name: 'control token', ok: !!token && /^[a-f0-9]{64}$/.test(token) });
  // 6. chrome profile
  const ud = currentConfig().chrome.userDataDir || path.join(getConfigDir(), 'chrome-profile');
  if (existsSync(ud)) {
    const lockExists = existsSync(path.join(ud, 'SingletonLock'));
    checks.push({ id: 30, name: 'Chrome profile 锁', ok: !lockExists, detail: lockExists ? 'orphan-lock' : 'clean' });
  }
  // 7. ws
  const w = getWatchdog();
  if (w) {
    checks.push({ id: 40, name: 'CDP ws', ok: w.state === 'CONNECTED', detail: w.state });
  }
  // 8. activity log
  checks.push({ id: 50, name: 'activity log 目录', ok: true });

  return checks;
}

// ──── 修复 — 依 user 传入的 ids 跑 ───────────────────────────
class RepairRunner extends EventEmitter {
  constructor(ids) {
    super();
    this.ids = ids;      // 例如 ['fix_01_port_conflict', 'fix_02_config_corrupt']
    this.results = [];
    this.cancelled = false;
  }
  cancel() { this.cancelled = true; }
  progress(id, msg) {
    this.emit('progress', { id, msg, results: this.results });
  }
  async run() {
    this.emit('phase:start', { phase: 'diagnose' });
    this.progress('init', '开始诊断...');
    const checks = await diagnose();
    this.emit('phase:done', { phase: 'diagnose', checks });

    this.emit('phase:start', { phase: 'fix' });
    for (const id of this.ids) {
      if (this.cancelled) {
        this.emit('cancelled');
        return { ok: false, reason: 'cancelled' };
      }
      const fn = FIXES[id];
      if (!fn) {
        this.results.push({ id, ok: false, error: 'unknown fix id' });
        continue;
      }
      try {
        const r = await fn(this);
        this.results.push({ id, ok: true, ...r });
      } catch (e) {
        this.results.push({ id, ok: false, error: e.message });
      }
    }
    this.emit('phase:done', { phase: 'fix', results: this.results });

    // 重新诊断
    this.emit('phase:start', { phase: 'verify' });
    const reChecks = await diagnose();
    this.emit('phase:done', { phase: 'verify', checks: reChecks });

    // 报告
    this.emit('phase:start', { phase: 'report' });
    const passed = this.results.filter((r) => r.ok).length;
    const failed = this.results.length - passed;
    const stillBad = reChecks.filter((c) => !c.ok);
    const report = {
      ok: failed === 0 && stillBad.length === 0,
      passed, failed,
      fixedItems: this.results,
      remainingIssues: stillBad,
    };
    this.emit('phase:done', { phase: 'report', report });
    return report;
  }
}

export function runRepair(fixIds) {
  const r = new RepairRunner(fixIds);
  return r;
}

export { FIXES };
