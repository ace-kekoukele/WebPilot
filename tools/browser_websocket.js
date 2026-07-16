// tools/browser_websocket.js — WebSocket 消息捕获（v4.0.4 修复版）
import { sendPageCommand } from '../lib/cdp/index.js';
import { on, off } from '../lib/cdp/transport.js';

const _buffers = new Map();          // targetId → messages[]
const _handlersInstalled = new Set(); // targetId → 已安装

// 安装全局 WebSocket 事件监听器
function installWebSocketHandlers(targetId) {
  if (_handlersInstalled.has(targetId)) return;

  const handlerReceived = (params) => {
    const buf = getBuffer(targetId);
    buf.push({
      type: 'received',
      timestamp: params.timestamp || Date.now(),
      opcode: params.response?.opcode,
      data: params.response?.payloadData,
      requestId: params.requestId,
      url: params.response?.url,
    });
  };

  const handlerSent = (params) => {
    const buf = getBuffer(targetId);
    buf.push({
      type: 'sent',
      timestamp: params.timestamp || Date.now(),
      opcode: params.response?.opcode,
      data: params.response?.payloadData,
      requestId: params.requestId,
      url: params.response?.url,
    });
  };

  const handlerError = (params) => {
    const buf = getBuffer(targetId);
    buf.push({
      type: 'error',
      timestamp: Date.now(),
      requestId: params.requestId,
      errorMessage: params.errorMessage,
    });
  };

  on('Network.webSocketFrameReceived', handlerReceived);
  on('Network.webSocketFrameSent', handlerSent);
  on('Network.webSocketFrameError', handlerError);

  _handlersInstalled.add(targetId);
}

function getBuffer(targetId) {
  if (!_buffers.has(targetId)) _buffers.set(targetId, []);
  return _buffers.get(targetId);
}

export const name = 'browser_websocket';
export const description = 'WebSocket 消息捕获: 监听/清除/列表 (v4.0.4 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'listen/stop/list/clear' },
  limit: { type: 'number', description: '最多返回消息数（默认 100）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});

    if (args.action === 'listen' || args.action === 'start') {
      installWebSocketHandlers(args.targetId);
      return { ok: true, listening: true, targetId: args.targetId };
    }

    if (args.action === 'stop') {
      _handlersInstalled.delete(args.targetId);
      return { ok: true, listening: false };
    }

    if (args.action === 'clear') {
      _buffers.set(args.targetId, []);
      return { ok: true, cleared: true };
    }

    // list / 默认
    const limit = args.limit || 100;
    const buf = getBuffer(args.targetId);
    const messages = buf.slice(-limit);
    return {
      ok: true,
      count: messages.length,
      total: buf.length,
      messages,
      stats: {
        total: buf.length,
        received: buf.filter((m) => m.type === 'received').length,
        sent: buf.filter((m) => m.type === 'sent').length,
        errors: buf.filter((m) => m.type === 'error').length,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
