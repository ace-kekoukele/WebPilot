// tools/browser_network.js - Network 观察 (list / get / initiator)
import { sendPageCommand } from '../lib/cdp/index.js';

const _buffers = new Map(); // targetId -> [requests]

export const name = 'browser_network';
export const description = 'Network 观察: list / get / initiator';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'list/get/initiator/clear' },
  requestId: { type: 'string' },
  urlFilter: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
    const buf = _buffers.get(args.targetId) || [];
    if (args.action === 'list' || !args.action) {
      let reqs = buf;
      if (args.urlFilter) reqs = reqs.filter((r) => r.url?.includes(args.urlFilter));
      return { ok: true, count: reqs.length, requests: reqs.slice(-50) };
    }
    if (args.action === 'get') {
      if (!args.requestId) return { ok: false, error: 'requestId required' };
      const r = buf.find((x) => x.requestId === args.requestId);
      if (!r) return { ok: false, error: 'request not found' };
      return { ok: true, request: r };
    }
    if (args.action === 'initiator') {
      if (!args.requestId) return { ok: false, error: 'requestId required' };
      const r = buf.find((x) => x.requestId === args.requestId);
      return { ok: true, initiator: r?.initiator || null, url: r?.url };
    }
    if (args.action === 'clear') {
      _buffers.set(args.targetId, []);
      return { ok: true, cleared: true };
    }
    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _net_buffers = _buffers;

// ──── tab close cleanup (Step 1 of 70-tools 8-step refactor) ──────
// _buffers Map 之前永不清理 — 关闭 tab 时清掉对应 buffer
// 由 daemon/module-cleanup.js 在 CDP Target.targetDestroyed 时调用
export function _onTabClose(targetId) {
  _buffers.delete(targetId);
}

export function _internal_stats() {
  let entries = 0;
  for (const buf of _buffers.values()) entries += buf.length;
  return {
    module: 'browser_network',
    pendingEntries: _buffers.size,
    bufferedRequests: entries,
  };
}