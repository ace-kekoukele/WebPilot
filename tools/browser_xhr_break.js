// tools/browser_xhr_break.js - XHR 断点
import { sendPageCommand } from '../lib/cdp/index.js';

const _patterns = new Set();

export const name = 'browser_xhr_break';
export const description = 'XHR/fetch 断点 (按 URL pattern)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'set/clear/list' },
  url: { type: 'string', description: 'URL pattern (set)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'DOMDebugger.enable', {}, 3000).catch(() => {});
    if (args.action === 'set') {
      if (!args.url) return { ok: false, error: 'url required' };
      await sendPageCommand(args.targetId, 'DOMDebugger.setXHRBreakpoint', { url: args.url }, 5000);
      _patterns.add(args.url);
      return { ok: true, url: args.url };
    }
    if (args.action === 'clear') {
      for (const p of _patterns) {
        await sendPageCommand(args.targetId, 'DOMDebugger.removeXHRBreakpoint', { url: p }, 3000).catch(() => {});
      }
      _patterns.clear();
      return { ok: true, cleared: true };
    }
    if (args.action === 'list') {
      return { ok: true, count: _patterns.size, patterns: [..._patterns] };
    }
    return { ok: false, error: 'action: set/clear/list' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}