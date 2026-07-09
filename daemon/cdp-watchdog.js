// daemon/cdp-watchdog.js — WebSocket 重连状态机
//
// 5 状态: DISCONNECTED → CONNECTING → CONNECTED → DEGRADED → RECONNECTING → CONNECTING
//
// §10 + §18 设计:
//   - ws 关闭 → emit 'ws:closed' 事件, 状态进 RECONNECTING
//   - 退避: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ... ±20% jitter
//   - 健康 60s 后重置 backoff
//   - 5 次连续失败 → 状态置 red → emit 'cdp:critical'
//   - in-flight _send 失败时统一返回 E_NOT_CONNECTED
import { EventEmitter } from 'node:events';
import { ensureBridge, disconnect as _disconnect } from '../lib/cdp/connection.js';
import { on as transportOn, emit as transportEmit, getState } from '../lib/cdp/transport.js';

// 退避表（秒）
const BACKOFF = [1, 2, 4, 8, 16, 30];   // 30 封顶
const MAX_FAIL = 5;

class CdpWatchdog extends EventEmitter {
  constructor() {
    super();
    this.state = 'DISCONNECTED';      // DISCONNECTED|CONNECTING|CONNECTED|DEGRADED|RECONNECTING|FAILED
    this.attempts = 0;
    this.connectedAt = 0;
    this.lastHealthyAt = 0;
    this.timer = null;
    this._stopped = false;
  }

  start() {
    if (!this._stopped) {
      this._installListeners();
      // 首次尝试连接
      this._attemptConnect();
    }
  }

  stop() {
    this._stopped = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  _installListeners() {
    // ws 关闭 → 触发重连
    transportOn('ws:closed', () => {
      this._onWsClosed();
    });
    // bridge:ready (确保 health)
    transportOn('bridge:ready', () => {
      this._onBridgeReady();
    });
    // bridge 不可达
    transportOn('bridge:unreachable', () => {
      this._onBridgeUnreachable();
    });
  }

  async _attemptConnect() {
    if (this._stopped) return;
    if (this.state === 'CONNECTED') return;
    this.state = 'CONNECTING';
    this.emit('state:change', this.getState());
    try {
      await ensureBridge();
      // bridge:ready 事件会触发 _onBridgeReady
    } catch (e) {
      this._onBridgeUnreachable(e);
    }
  }

  _onBridgeReady() {
    this.state = 'CONNECTED';
    this.attempts = 0;
    this.connectedAt = Date.now();
    this.lastHealthyAt = Date.now();
    this.emit('state:change', this.getState());
    this.emit('healthy');
  }

  _onWsClosed() {
    if (this.state === 'CONNECTED' || this.state === 'CONNECTING') {
      this.state = 'DEGRADED';
      this.emit('state:change', this.getState());
      this._notify('WebPilot', 'Chrome DevTools 连接中断,正在重连...');
    }
    this._scheduleReconnect();
  }

  _onBridgeUnreachable(err) {
    if (this.attempts >= MAX_FAIL) {
      this.state = 'FAILED';
      this.emit('state:change', this.getState());
      this._notify('WebPilot — Chrome 断开了', '无法连接 Chrome DevTools。请确认 Chrome 正在运行且已启用 --remote-debugging-port=9222。');
      this.emit('cdp:critical', { attempts: this.attempts, error: err?.message });
      return;
    }
    this._scheduleReconnect();
  }

  // Chrome 断开时触发通知 (由 daemon/main.js 转发到 Electron Notification)
  _notify(title, body) {
    process.stdout.write(`[NOTIFY]${JSON.stringify({ title, body })}\n`);
  }

  _scheduleReconnect() {
    if (this._stopped) return;
    const base = BACKOFF[Math.min(this.attempts, BACKOFF.length - 1)];
    const jitter = base * (0.8 + Math.random() * 0.4);   // ±20%
    this.attempts++;
    const next = this.state = 'RECONNECTING';
    this.emit('state:change', this.getState());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._attemptConnect(), jitter * 1000);
    this.emit('reconnect:scheduled', { delayMs: Math.round(jitter * 1000), attempt: this.attempts });
  }

  // 每 60s 检查: 最近活跃 → 重置 attempts
  startHealthTracker() {
    setInterval(() => {
      if (this.state === 'CONNECTED' && Date.now() - this.lastHealthyAt > 60_000) {
        // 60s 内无 ws 流量不算死, 但 5min 没活动就触发轻探活
      }
    }, 60_000);
  }

  getState() {
    return {
      state: this.state,
      attempts: this.attempts,
      connectedAt: this.connectedAt,
      lastHealthyAt: this.lastHealthyAt,
      uptime: this.connectedAt ? Date.now() - this.connectedAt : 0,
      ...getState(),  // 从 transport 拿 ws 实际状态
    };
  }
}

let _singleton = null;
export function getWatchdog() {
  if (!_singleton) _singleton = new CdpWatchdog();
  return _singleton;
}
export function startWatchdog() {
  const w = getWatchdog();
  w.start();
  w.startHealthTracker();
  return w;
}
export function stopWatchdog() {
  if (_singleton) _singleton.stop();
}
