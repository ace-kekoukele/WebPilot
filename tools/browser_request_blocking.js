// tools/browser_request_blocking.js - 屏蔽 URL 模式 (Chrome 150 Network 增强)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_request_blocking';
export const description = '屏蔽 URL 模式 (Network.blockedUrls) (Chrome 150 Network 域增强)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'enable/disable' },
  urlPatterns: { type: 'array', description: '要屏蔽的 URL 模式数组 (enable 时)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };

    if (args.action === 'enable') {
      if (!args.urlPatterns || !Array.isArray(args.urlPatterns) || args.urlPatterns.length === 0) {
        return { ok: false, error: 'urlPatterns (array) required' };
      }
      await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
      await sendPageCommand(args.targetId, 'Network.setBlockedURLs', {
        urls: args.urlPatterns,
      }, 5000);
      return { ok: true, blocked: args.urlPatterns.length, patterns: args.urlPatterns };
    }

    if (args.action === 'disable') {
      await sendPageCommand(args.targetId, 'Network.setBlockedURLs', { urls: [] }, 5000);
      return { ok: true, cleared: true };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}