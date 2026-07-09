// tools/browser_websocket.js - WebSocket message capture
import { sendPageCommand } from '../lib/cdp/index.js';

const _buffers = new Map();
let _wsEnabled = false;

export const name = 'browser_websocket';
export const description = 'WebSocket 消息捕获';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'list/clear' },
  limit: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
    if (!_wsEnabled) {
      // listen to Network.webSocketFrameReceived/Received/Sent
      // events are wired in cdp-manager
      _wsEnabled = true;
    }
    const buf = _buffers.get(args.targetId) || [];
    if (args.action === 'clear') {
      _buffers.set(args.targetId, []);
      return { ok: true, cleared: true };
    }
    const limit = args.limit || 50;
    return { ok: true, count: buf.length, messages: buf.slice(-limit) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _ws_buffers = _buffers;