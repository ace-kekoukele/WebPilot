// tools/browser_intercept.js - Fetch interceptor
import { ensureBridge, sendPageCommand } from '../lib/cdp/index.js';

const _patterns = new Set();
let _enabled = false;

export const name = 'browser_intercept';
export const description = 'Fetch 拦截 — 启用/禁用 拦截指定 URL pattern';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'enable/disable/fulfill/continue' },
  patterns: { type: 'array', description: 'URL patterns' },
  statusCode: { type: 'number' },
  body: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await ensureBridge();
    if (args.action === 'enable') {
      for (const p of args.patterns || []) _patterns.add(p);
      await sendPageCommand(args.targetId, 'Fetch.enable', { patterns: [..._patterns].map((p) => ({ urlPattern: p })) }, 5000);
      _enabled = true;
      return { ok: true, enabled: [..._patterns] };
    }
    if (args.action === 'disable') {
      await sendPageCommand(args.targetId, 'Fetch.disable', {}, 5000);
      _patterns.clear();
      _enabled = false;
      return { ok: true, disabled: true };
    }
    return { ok: false, error: 'action: enable/disable (continue/fulfill TBD via requestId)' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}