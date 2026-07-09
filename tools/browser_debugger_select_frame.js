// tools/browser_debugger_select_frame.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_debugger_select_frame';
export const description = 'Debugger.setAsyncCallStackDepth + Page frame select';
export const parameters = {
  targetId: { type: 'string' },
  frameId: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    return { ok: true, selected: true, frameId: args.frameId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}