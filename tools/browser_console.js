// tools/browser_console.js (简化版) — enable Console domain
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_console';
export const description = 'Enable Console.log 监听 (CDP Console.enable)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
};

export async function execute(args, ctx) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await ensureBridge();
    await sendPageCommand(args.targetId, 'Runtime.enable', {}, 5000);
    await sendPageCommand(args.targetId, 'Console.enable', {}, 5000);
    return { ok: true, enabled: ['Runtime', 'Console'] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}