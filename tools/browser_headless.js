// tools/browser_headless.js - 新 Headless 模式控制 (Chrome 150 HeadlessExperimental)
import { sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_headless';
export const description = '新 Headless 模式控制: beginFrame/Screenshot (Chrome 150 HeadlessExperimental 域)';
export const parameters = {
  action: { type: 'string', description: 'enable/beginFrame/screenshot/dispose' },
  screenshotFormat: { type: 'string', description: 'png/jpeg (默认 png)' },
};

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (enable/beginFrame/screenshot/dispose)' };

    if (args.action === 'enable') {
      await sendCommand('HeadlessExperimental.enable', {}, 3000);
      return { ok: true, enabled: true };
    }

    if (args.action === 'beginFrame') {
      await sendCommand('HeadlessExperimental.beginFrame', {
        frameTimeTicks: 16,  // 60fps
        screenshotFormat: args.screenshotFormat || 'png',
      }, 10000);
      return { ok: true, frameStarted: true };
    }

    if (args.action === 'screenshot') {
      // 触发 beginFrame 并返回 base64 screenshot
      const r = await sendCommand('HeadlessExperimental.beginFrame', {
        frameTimeTicks: 16,
        screenshotFormat: args.screenshotFormat || 'png',
      }, 15000);
      return {
        ok: true,
        hasFrame: !!r.screenshotData,
        sizeBytes: r.screenshotData ? r.screenshotData.length : 0,
        format: args.screenshotFormat || 'png',
        // base64 数据较大, 调用方按需返回
        screenshotData: r.screenshotData,
      };
    }

    if (args.action === 'dispose') {
      await sendCommand('HeadlessExperimental.disable', {}, 3000);
      return { ok: true, disposed: true };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}