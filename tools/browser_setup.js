// tools/browser_setup.js - 初始化检查
import { ensureBridge, listTabs } from '../lib/cdp/index.js';

export const name = 'browser_setup';
export const description = '初始化检查 (Chrome + port + tools)';
export const parameters = { port: { type: 'number' }, host: { type: 'string' } };

export async function execute(args) {
  try {
    await ensureBridge(args.port, args.host);
    const tabs = await listTabs();
    return { ok: true, port: args.port || 9222, host: args.host || '127.0.0.1', tabCount: tabs.length, version: '1.7.0', status: 'ready' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}