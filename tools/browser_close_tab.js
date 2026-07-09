// tools/browser_close_tab.js
import { closeTab } from '../lib/cdp/index.js';

export const name = 'browser_close_tab';
export const description = '关闭标签页';
export const parameters = { targetId: { type: 'string' } };

export async function execute(args) {
  if (!args.targetId) return { ok: false, error: 'targetId required' };
  await closeTab(args.targetId);
  return { ok: true, closed: args.targetId };
}