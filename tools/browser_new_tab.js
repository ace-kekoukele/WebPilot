// tools/browser_new_tab.js - alias
import { newTab } from '../lib/cdp/index.js';

export const name = 'browser_new_tab';
export const description = '创建新标签页';
export const parameters = { url: { type: 'string' } };

export async function execute(args) {
  const t = await newTab(args.url || 'about:blank');
  return { ok: true, targetId: t.targetId, sessionId: t.sessionId };
}