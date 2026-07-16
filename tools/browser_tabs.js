// tools/browser_tabs.js - 列出/关闭 tabs
import { listTabs, newTab, closeTab } from '../lib/cdp/index.js';

export const name = 'browser_tabs';
export const description = '管理 Chrome 标签页: list / open / close';
export const parameters = {
  action: { type: 'string', description: 'list / open / close' },
  url: { type: 'string', description: 'open 时的 URL' },
  targetId: { type: 'string', description: 'close 时的 targetId' },
};

export async function execute(args, ctx) {
  try {
    if (args.action === 'list' || !args.action) {
      const tabs = await listTabs();
      return { ok: true, count: tabs.length, tabs };
    }
    if (args.action === 'open') {
      const t = await newTab(args.url || 'about:blank');
      return { ok: true, targetId: t.targetId, sessionId: t.sessionId };
    }
    if (args.action === 'close') {
      if (!args.targetId) return { ok: false, error: 'targetId required for close' };
      await closeTab(args.targetId);
      return { ok: true, closed: args.targetId };
    }
    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}