// tools/browser_navigate.js - 导航到 URL
import { navigate, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_navigate';
export const description = '在指定标签页导航到 URL';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  url: { type: 'string', description: '目标 URL' },
};

export async function execute(args, ctx) {
  if (!args.targetId) return { ok: false, error: 'targetId required' };
  if (!args.url) return { ok: false, error: 'url required' };
  try {
    await ensureBridge();
    const r = await navigate(args.targetId, args.url);
    if (r.errorText) return { ok: false, error: r.errorText };
    return { ok: true, frameId: r.frameId, loaderId: r.loaderId, url: args.url };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}