// daemon/agent-registry.js — 已连接 Agent 管理 (§25 passive listener)
//
// 任何 MCP 客户端 (Claude / Cursor / Hermes / 自研) 连到我们, 我们:
//   - 用 initialize.clientInfo 自识别 (name + version)
//   - 跟踪连接 / 活跃 / 断开
//   - 提供 list / get / disconnect API 给 GUI / CLI
//
// lib/mcp-server.js 里的 _connectedAgents 是临时版本, 这里搬到 daemon 模块集中管理.
import { EventEmitter } from 'node:events';

const HEARTBEAT_TIMEOUT_MS = 60_000;

class AgentRegistry extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, {id, name, version, protocol, connectedAt, lastActiveAt, callCount, errorCount}>} */
    this._agents = new Map();
    // unref'd: 不阻止进程退出（测试时）
    this._heartbeatTimer = setInterval(() => this._heartbeatTick(), 30_000);
    if (typeof this._heartbeatTimer.unref === 'function') this._heartbeatTimer.unref();
  }

  register(connectionId, clientInfo = {}) {
    if (this._agents.has(connectionId)) return this._agents.get(connectionId);
    const info = {
      id: connectionId,
      name: clientInfo.name || 'Unknown Agent',
      version: clientInfo.version || 'unknown',
      protocol: clientInfo.protocol || 'mcp',
      protocolVersion: clientInfo.protocolVersion || null,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
      callCount: 0,
      errorCount: 0,
    };
    this._agents.set(connectionId, info);
    this.emit('agent:connected', info);
    return info;
  }

  heartbeat(connectionId) {
    const a = this._agents.get(connectionId);
    if (a) a.lastActiveAt = Date.now();
  }

  recordCall(connectionId, { ok = true } = {}) {
    const a = this._agents.get(connectionId);
    if (!a) return;
    a.callCount++;
    if (!ok) a.errorCount++;
    a.lastActiveAt = Date.now();
    this.emit('agent:active', { agent: a, ok });
  }

  disconnect(connectionId) {
    const a = this._agents.get(connectionId);
    if (!a) return false;
    this._agents.delete(connectionId);
    this.emit('agent:disconnected', a);
    return true;
  }

  list() {
    return Array.from(this._agents.values()).sort((x, y) => y.connectedAt - x.connectedAt);
  }

  get(connectionId) {
    return this._agents.get(connectionId) || null;
  }

  count() { return this._agents.size; }

  // 5 个 Agent 的 colors (§10.7)
  static colorFor(name) {
    const map = {
      'Claude Desktop':   '#D97706',
      'Claude Code':       '#F97316',
      'Cursor':            '#7C3AED',
      'Continue':          '#3B82F6',
      'Hermes':            '#10B981',
      'Max Code':           '#EC4899',
      'Cherry Studio':     '#F43F5E',
      'Codex CLI':         '#0F172A',
      'Cline':              '#06B6D4',
      'Aider':              '#22C55E',
      'Windsurf':           '#0EA5E9',
    };
    return map[name] || '#A78BFA';   // 兜底紫
  }

  _heartbeatTick() {
    const now = Date.now();
    for (const [id, a] of this._agents) {
      if (now - a.lastActiveAt > HEARTBEAT_TIMEOUT_MS) {
        // 超时 inactive (但不断开, 等 ws close)
        this.emit('agent:idle', a);
      }
    }
  }

  stop() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
  }
}

let _singleton = null;
export function getAgentRegistry() {
  if (!_singleton) _singleton = new AgentRegistry();
  return _singleton;
}
export function startAgentRegistry() { return getAgentRegistry(); }

// 暴露 class 本身 (测试 + 派生用)
export { AgentRegistry };
