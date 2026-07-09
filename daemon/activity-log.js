// daemon/activity-log.js — Agent 操作日志 (§4.3.5.2 Activity Log 面板)
//
// 内存 ring buffer (默认 10000 条) + JSONL 文件 (~/.webpilot/activity/activity-YYYY-MM-DD.jsonl)
// 保留 7 天 (rotation)
// 按 agent 颜色 + 工具分类 + 成功/失败 过滤
//
// 跟 lib/mcp-server.js 工具调用绑定: 每个 toolCall → log(event)
import { EventEmitter } from 'node:events';
import { mkdirSync, existsSync, appendFileSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { getConfigDir } from './config.js';
import { RingBuffer } from './ring-buffer.js';

const MAX_INMEM = 10_000;

class ActivityLog extends EventEmitter {
  constructor() {
    super();
    /** @type {RingBuffer} */
    this._buffer = new RingBuffer(MAX_INMEM);  // O(1) 环形缓冲区
    this._todayFile = this._dateFile(new Date());
    this._ensureDir();
    // 启动时回放当天文件 (限制 5000 条)
    this._replayToday();
  }

  _dir() {
    return path.join(getConfigDir(), 'activity');
  }

  _dateFile(d) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return path.join(this._dir(), `activity-${ds}.jsonl`);
  }

  _ensureDir() { try { mkdirSync(this._dir(), { recursive: true }); } catch {} }

  _replayToday() {
    const file = this._dateFile(new Date());
    if (!existsSync(file)) return;
    try {
      const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).slice(-MAX_INMEM);
      for (const line of lines) {
        try { this._buffer.push(JSON.parse(line)); } catch {}
      }
    } catch {}
  }

  log(event) {
    // event: { ts?, agent, tool, args, ok, error?, durationMs, targetId? }
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
    this._buffer.push(entry);

    // 切日时滚动
    const today = this._dateFile(new Date());
    if (today !== this._todayFile) this._todayFile = today;

    // 写文件
    try { appendFileSync(this._todayFile, JSON.stringify(entry) + '\n'); } catch {}
    this.emit('activity', entry);

    // B2-21: 工具调用失败时推桌面通知
    if (!entry.ok && entry.error && entry.tool) {
      try {
        process.stdout.write(`[NOTIFY]${JSON.stringify({ title: `工具调用失败 — ${entry.tool}`, body: entry.error.slice(0, 120) })}\n`);
      } catch {}
    }
  }

  query({ agent, tool, ok, since, until, limit = 200 } = {}) {
    let out = this._buffer.toArray().reverse();  // 新的在前
    if (agent) out = out.filter((e) => e.agent === agent);
    if (tool) out = out.filter((e) => e.tool === tool);
    if (typeof ok === 'boolean') out = out.filter((e) => e.ok === ok);
    if (since) out = out.filter((e) => e.ts >= since);
    if (until) out = out.filter((e) => e.ts <= until);
    return out.slice(0, limit);
  }

  // 7 天轮转
  rotate() {
    try {
      const dir = this._dir();
      if (!existsSync(dir)) return;
      const cutoff = Date.now() - 7 * 86400 * 1000;
      for (const f of readdirSync(dir)) {
        const m = f.match(/^activity-(\d{4})-(\d{2})-(\d{2})\.jsonl$/);
        if (!m) continue;
        const t = new Date(`${m[1]}-${m[2]}-${m[3]}`).getTime();
        if (t < cutoff) try { unlinkSync(path.join(dir, f)); } catch {}
      }
    } catch {}
  }

  size() { return this._buffer.length; }
  clear() { this._buffer.clear(); }
}

let _singleton = null;
export function getActivityLog() {
  if (!_singleton) { _singleton = new ActivityLog(); _singleton.rotate(); }
  return _singleton;
}
