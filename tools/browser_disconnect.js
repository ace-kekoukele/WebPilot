// tools/browser_disconnect.js
import { disconnect } from '../lib/cdp/index.js';

export const name = 'browser_disconnect';
export const description = '断开 Chrome CDP 连接';
export const parameters = {};

export async function execute(args) {
  await disconnect();
  return { ok: true, disconnected: true };
}