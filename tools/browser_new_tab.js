// tools/browser_new_tab.js - alias
import { newTab } from '../lib/cdp/index.js';

export const name = 'browser_new_tab';
export const description = '创建新标签页';
export const parameters = { url: { type: 'string', description: '打开的 URL，默认 about:blank' } };

export async function execute(args) {
  try {
    const t = await newTab(args.url || 'about:blank');
    return { ok: true, targetId: t.targetId, sessionId: t.sessionId, url: args.url || 'about:blank' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}