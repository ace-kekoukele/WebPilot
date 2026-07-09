// tools/browser_debugger_remove.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_debugger_remove';
export const description = '移除断点 (alias of browser_debugger remove)';
export const parameters = {
  targetId: { type: 'string' },
  breakpointId: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.breakpointId) return { ok: false, error: 'breakpointId required' };
    await sendPageCommand(args.targetId, 'Debugger.removeBreakpoint', { breakpointId: args.breakpointId }, 3000);
    return { ok: true, removed: args.breakpointId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}