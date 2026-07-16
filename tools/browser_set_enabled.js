// tools/browser_set_enabled.js
import { ensureBridge, disconnect } from '../lib/cdp/index.js';

export const name = 'browser_set_enabled';
export const description = '开启/关闭 browser-bridge 插件';
export const parameters = { enabled: { type: 'boolean' } };

export async function execute(args) {
  if (args.enabled === false) {
    await disconnect();
    return { ok: true, enabled: false };
  }
  await ensureBridge();
  return { ok: true, enabled: true };
}