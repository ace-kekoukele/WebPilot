// daemon/recorder.js — Chrome 操作录制器
// 监听 Input.dispatchMouseEvent / dispatchKeyEvent + Page.navigate 事件
// 导出可回放的脚本 JSON
import { EventEmitter } from 'node:events';
import { getConfigDir } from './config.js';
import { on } from '../lib/cdp/index.js';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

class Recorder extends EventEmitter {
  constructor() {
    super();
    this._recording = false;
    this._events = [];
    this._offMouse = null;
    this._offKey = null;
    this._offNav = null;
  }

  start(targetId) {
    if (this._recording) return;
    this._recording = true;
    this._events = [];

    this._offMouse = on('Input.dispatchMouseEvent', (params) => {
      if (!this._recording) return;
      this._events.push({ ts: Date.now(), type: 'mouse', ...params });
    });

    this._offKey = on('Input.dispatchKeyEvent', (params) => {
      if (!this._recording) return;
      this._events.push({ ts: Date.now(), type: 'key', ...params });
    });

    this._offNav = on('Page.navigatedWithinDocument', (params) => {
      if (!this._recording) return;
      this._events.push({ ts: Date.now(), type: 'nav', url: params.url });
    });

    this.emit('start');
  }

  stop() {
    if (!this._recording) return;
    this._recording = false;
    this._offMouse?.(); this._offMouse = null;
    this._offKey?.(); this._offKey = null;
    this._offNav?.(); this._offNav = null;
    this.emit('stop', this._events.length);
  }

  isRecording() { return this._recording; }
  events() { return this._events; }
  clear() { this._events = []; }

  /** 导出可回放 JSON */
  export() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      eventCount: this._events.length,
      events: this._events,
    };
  }

  /** 保存到文件 */
  save(filename) {
    try {
      const dir = path.join(getConfigDir(), 'recordings');
      mkdirSync(dir, { recursive: true });
      const p = path.join(dir, filename || `recording-${Date.now()}.json`);
      writeFileSync(p, JSON.stringify(this.export(), null, 2));
      return { ok: true, path: p };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
}

let _singleton = null;
export function getRecorder() {
  if (!_singleton) _singleton = new Recorder();
  return _singleton;
}
export function startRecorder(targetId) { getRecorder().start(targetId); }
export function stopRecorder() { getRecorder().stop(); }
