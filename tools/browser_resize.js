// tools/browser_resize.js - viewport 调整
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_resize';
export const description = '调整 viewport 大小';
export const parameters = {
  targetId: { type: 'string' },
  width: { type: 'number' },
  height: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Emulation.setDeviceMetricsOverride', {
      width: args.width || 1280, height: args.height || 720,
      deviceScaleFactor: 1, mobile: false,
    }, 5000);
    return { ok: true, width: args.width, height: args.height };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}