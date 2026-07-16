// tools/browser_connect.js
import { ensureBridge, isConnected } from '../lib/cdp/index.js';

export const name = 'browser_connect';
export const description = '连接 Chrome CDP';
export const parameters = {
  port: { type: 'number', description: 'Chrome 远程调试端口，默认 9222' },
  host: { type: 'string', description: 'Chrome 主机地址，默认 127.0.0.1' },
};

export async function execute(args) {
  try {
    await ensureBridge(args.port || 9222, args.host || '127.0.0.1');
    const connected = isConnected();
    return { ok: connected, connected, port: args.port || 9222, host: args.host || '127.0.0.1' };
  } catch (err) {
    return { ok: false, error: err.message, connected: false };
  }
}