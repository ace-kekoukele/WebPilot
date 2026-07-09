// daemon/logger.js — 结构化日志 + 7 天轮转
//
// 一行 JSON 一条日志: { ts, level, module, msg, ...extra }
// 写到: %LOCALAPPDATA%\BrowserBridge\logs\bb-YYYY-MM-DD.log
// 保留: cfg.logging.retentionDays (default 7) / 总大小: cfg.logging.maxTotalMB (default 500)
import { mkdirSync, existsSync, writeFileSync, appendFileSync, readdirSync, statSync, unlinkSync, renameSync } from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { currentConfig, getConfigDir } from './config.js';

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const LEVEL_NAME = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

function logDir() {
  return process.env.BB_LOG_DIR || path.join(getConfigDir(), 'logs');
}
function logFile(date) {
  const ymd = date || new Date();
  const ds = `${ymd.getFullYear()}-${String(ymd.getMonth() + 1).padStart(2, '0')}-${String(ymd.getDate()).padStart(2, '0')}`;
  return path.join(logDir(), `bb-${ds}.log`);
}

class Logger {
  constructor() {
    this.ee = new EventEmitter();
    this._ensureDir();
    this._tick = null;
    this._setLevelFromConfig();
    this._scheduleRotate();
  }

  _setLevelFromConfig() {
    try {
      const cfg = currentConfig();
      const lv = cfg?.logging?.level || 'info';
      this.level = LEVELS[lv] || LEVELS.info;
    } catch { this.level = LEVELS.info; }
  }

  _ensureDir() {
    try { mkdirSync(logDir(), { recursive: true }); } catch {}
  }

  _scheduleRotate() {
    // 每分钟检查一次日期变化, 触发日轮转 + 清旧文件
    if (this._tick) clearInterval(this._tick);
    this._tick = setInterval(() => this.rotateIfNeeded(), 60_000);
  }

  rotateIfNeeded() {
    try {
      this._setLevelFromConfig();
      const dir = logDir();
      if (!existsSync(dir)) return;
      const files = readdirSync(dir).filter((f) => /^bb-\d{4}-\d{2}-\d{2}\.log$/.test(f));
      const today = logFile();
      // 轮转: 如果文件超过 50MB, rename → bb-YYYY-MM-DD.<N>.log
      for (const f of files) {
        const p = path.join(dir, f);
        try {
          const st = statSync(p);
          if (st.size > 50 * 1024 * 1024 && p !== today) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            renameSync(p, path.join(dir, `${f.replace(/\.log$/, '')}.${ts.slice(0, 16)}.log`));
          }
        } catch {}
      }
      // 删旧 (超过 retentionDays)
      const cfg = currentConfig();
      const days = cfg?.logging?.retentionDays ?? 7;
      const cutoff = Date.now() - days * 86400 * 1000;
      for (const f of files) {
        try {
          const m = f.match(/^bb-(\d{4})-(\d{2})-(\d{2})\.log/);
          if (!m) continue;
          const t = new Date(`${m[1]}-${m[2]}-${m[3]}`).getTime();
          if (t < cutoff) {
            const p = path.join(dir, f);
            try { unlinkSync(p); } catch {}
          }
        } catch {}
      }
      // maxTotalMB 限制: 删最旧的直到 ≤ 上限
      const maxMB = cfg?.logging?.maxTotalMB ?? 500;
      let totalBytes = 0;
      const sortedFiles = files.map((f) => path.join(dir, f)).sort(); // 日期排序, 旧→新
      const sizes = sortedFiles.map((f) => { try { return { f, size: statSync(f).size }; } catch { return { f, size: 0 }; } });
      for (const { f, size } of sizes) totalBytes += size;
      const capBytes = maxMB * 1024 * 1024;
      for (const { f, size } of sizes) {
        if (totalBytes <= capBytes) break;
        if (f === today) continue;     // 当天的永远保留
        try { unlinkSync(f); totalBytes -= size; } catch {}
      }
    } catch {}
  }

  child(meta) {
    const self = this;
    const bound = {};
    for (const lv of Object.keys(LEVELS)) {
      bound[lv] = (msg, extra) => self._log(lv, msg, { ...meta, ...(extra || {}) });
    }
    return bound;
  }

  _log(level, msg, extra = {}) {
    const lvlIdx = LEVELS[level] || LEVELS.info;
    if (lvlIdx < this.level) return;
    const entry = {
      ts: new Date().toISOString(),
      level: LEVEL_NAME[lvlIdx / 10 - 1] || 'INFO',
      msg: typeof msg === 'string' ? msg : JSON.stringify(msg),
      ...(extra || {}),
    };
    // JSON 一行
    const line = JSON.stringify(entry) + '\n';
    try { appendFileSync(logFile(), line); } catch {}
    // 终端输出（stderr 不污染 stdout - daemon 用）
    const stream = (level === 'error' || level === 'fatal') ? process.stderr : process.stderr;
    stream.write(line);
    // 事件 (renderer 经 SSE 订阅)
    this.ee.emit('log', entry);
  }

  trace(msg, extra) { this._log('trace', msg, extra); }
  debug(msg, extra) { this._log('debug', msg, extra); }
  info(msg, extra) { this._log('info', msg, extra); }
  warn(msg, extra) { this._log('warn', msg, extra); }
  error(msg, extra) { this._log('error', msg, extra); }
  fatal(msg, extra) { this._log('fatal', msg, extra); }

  // 异步流 (debug 用)
  tail(lines = 100) {
    const dir = logDir();
    if (!existsSync(logFile())) return [];
    try {
      const data = require('node:fs').readFileSync(logFile(), 'utf8');
      return data.split(/\r?\n/).filter(Boolean).slice(-lines).map((l) => {
        try { return JSON.parse(l); } catch { return { msg: l }; }
      });
    } catch { return []; }
  }
}

let _singleton = null;
export function getLogger() {
  if (!_singleton) _singleton = new Logger();
  return _singleton;
}
export function setupLogger() { return getLogger(); }

// child logger 用法:
//   const log = require('./logger.js').getLogger().child({ module: 'cdp-watchdog' });
//   log.info('hello', { extra: 'foo' });
