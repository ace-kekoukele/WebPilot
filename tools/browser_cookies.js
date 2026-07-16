// tools/browser_cookies.js - Cookie 操作
import { ensureBridge, sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_cookies';
export const description = 'Browser-level Cookie 管理 (get/set/clear)';
export const parameters = {
  action: { type: 'string', description: 'get/set/clear' },
  urls: { type: 'array' },
  name: { type: 'string' },
  value: { type: 'string' },
  domain: { type: 'string' },
  path: { type: 'string' },
  expires: { type: 'number' },
  httpOnly: { type: 'boolean' },
  secure: { type: 'boolean' },
  sameSite: { type: 'string' },
};

export async function execute(args) {
  try {
    await ensureBridge();
    if (!args.action || args.action === 'get') {
      const r = await sendCommand('Network.getCookies', { urls: args.urls || [] });
      return { ok: true, count: r.cookies.length, cookies: r.cookies };
    }
    if (args.action === 'set') {
      if (!args.name || !args.domain) return { ok: false, error: 'name+domain required' };
      const r = await sendCommand('Network.setCookie', {
        name: args.name,
        value: args.value || '',
        domain: args.domain,
        path: args.path || '/',
        expires: args.expires || -1,
        httpOnly: !!args.httpOnly,
        secure: !!args.secure,
        sameSite: args.sameSite,
      });
      return { ok: r.success !== false };
    }
    if (args.action === 'clear') {
      await sendCommand('Network.clearBrowserCookies');
      return { ok: true, cleared: true };
    }
    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}