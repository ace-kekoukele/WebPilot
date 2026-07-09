// tools/browser_connect.js
import { ensureBridge, isConnected } from '../lib/cdp/index.js';

export const name = 'browser_connect';
export const description = '连接 Chrome CDP';
export const parameters = { port: { type: 'number' }, host: { type: 'string' } };

export async function execute(args) {
  await ensureBridge(args.port || 9222, args.host || '127.0.0.1');
  return { ok: true, connected: isConnected() };
}