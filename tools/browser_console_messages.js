// tools/browser_console_messages.js - enable + retrieve messages
import { sendPageCommand } from '../lib/cdp/index.js';

const _buffers = new Map();

export const name = 'browser_console_messages';
export const description = '启用 console 监听 + 返回最近消息';
export const parameters = {
  targetId: { type: 'string' },
  levels: { type: 'array', description: 'info/error/warn/log' },
  limit: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Runtime.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Log.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Console.enable', {}, 3000).catch(() => {});
    const buf = _buffers.get(args.targetId) || [];
    const limit = args.limit || 50;
    return { ok: true, count: buf.length, messages: buf.slice(-limit) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _console_msgs = _buffers;