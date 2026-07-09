// tools/browser_list_tabs.js - alias
import { listTabs } from '../lib/cdp/index.js';

export const name = 'browser_list_tabs';
export const description = '列出 Chrome 标签页 (alias of browser_tabs list)';
export const parameters = {};

export async function execute(args) {
  const tabs = await listTabs();
  return { ok: true, count: tabs.length, tabs };
}