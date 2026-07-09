// tools/browser_health.js - 健康检查
import { ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_health';
export const description = '检查 Chrome CDP 连接 + 列 tabs';
export const parameters = {};

export async function execute(args, ctx) {
  try {
    await ensureBridge();
    const { listTabs } = await import('../lib/cdp/index.js');
    const tabs = await listTabs();
    return { ok: true, tabCount: tabs.length, tabs: tabs.slice(0, 10) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}