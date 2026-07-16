// daemon/console-stream.js — Console 事件持久化 + SSE 推送
// 监听 Runtime.consoleAPICalled + Log.entryAdded, ring buffer 1000 条, 客户端可 SSE 订阅
import { on, listTargets } from '../lib/cdp/index.js';
import { RingBuffer } from './ring-buffer.js';

const RING_SIZE = 1000;
const buffer = new RingBuffer(RING_SIZE);  // O(1) 环形缓冲区
const subscribers = new Set();  // SSE clients

let started = false;
let offConsole = null;
let offLog = null;

function push(entry) {
  const wrapped = { ts: Date.now(), ...entry };
  buffer.push(wrapped);
  // 推给所有 SSE 订阅者
  const line = `data: ${JSON.stringify(entry)}\n\n`;
  for (const res of subscribers) {
    try { res.write(line); } catch {}
  }
}

export function getBuffer() {
  return buffer.toArray();
}

export function addSubscriber(res) {
  subscribers.add(res);
  // 立即推最近 50 条给新订阅者，衔接
  for (const e of buffer.recent(50)) {
    try { res.write(`data: ${JSON.stringify(e)}\n\n`); } catch {}
  }
}

export function removeSubscriber(res) {
  subscribers.delete(res);
}

async function refreshListeners() {
  // 每个 target 都启 Runtime.enable + Log.enable, 然后监听全局事件
  if (offConsole) { offConsole(); offConsole = null; }
  if (offLog) { offLog(); offLog = null; }

  offConsole = on('Runtime.consoleAPICalled', (params, sessionId) => {
    push({
      kind: 'console',
      type: params.type || 'info',
      args: (params.args || []).map((a) => a.value ?? a.description ?? JSON.stringify(a)),
      url: params.stackTrace?.callFrames?.[0]?.url,
      line: params.stackTrace?.callFrames?.[0]?.lineNumber,
      sessionId,
    });
  });

  offLog = on('Log.entryAdded', (params) => {
    const entry = params.entry || {};
    push({
      kind: 'log',
      type: entry.level || 'info',
      text: entry.text || '',
      url: entry.url,
      line: entry.lineNumber,
      source: entry.source,
    });
  });
}

export async function ensureConsoleStream() {
  if (started) return;
  started = true;
  await refreshListeners();

  // target 列表变化时重新挂监听 (新 tab attach 后)
  setInterval(async () => {
    try {
      const tabs = await listTargets();
      for (const t of tabs) {
        // 对每个 tab 启 Runtime.enable (幂等)
        const { sendCommand } = await import('../lib/cdp/index.js');
        sendCommand(t.id, 'Runtime.enable', {}).catch(() => {});
        sendCommand(t.id, 'Log.enable', {}).catch(() => {});
      }
    } catch {}
  }, 5000);
}