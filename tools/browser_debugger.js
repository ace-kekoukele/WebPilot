// tools/browser_debugger.js - 综合 debugger (break/pause/resume/step/state/remove)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_debugger';
export const description = 'Debugger 控制: break/pause/resume/step/state/remove';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'break/pause/resume/step/state/remove' },
  url: { type: 'string' },
  lineNumber: { type: 'number' },
  columnNumber: { type: 'number' },
  condition: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Debugger.enable', {}, 3000).catch(() => {});
    if (args.action === 'break') {
      const r = await sendPageCommand(args.targetId, 'Debugger.setBreakpointByUrl', {
        urlRegex: args.url,
        lineNumber: args.lineNumber || 0,
        columnNumber: args.columnNumber || 0,
        condition: args.condition,
      }, 5000);
      return { ok: true, breakpointId: r.breakpointId || args.url };
    }
    if (args.action === 'pause') {
      await sendPageCommand(args.targetId, 'Debugger.pause', {}, 3000);
      return { ok: true, paused: true };
    }
    if (args.action === 'resume') {
      await sendPageCommand(args.targetId, 'Debugger.resume', {}, 3000);
      return { ok: true, resumed: true };
    }
    if (args.action === 'step') {
      await sendPageCommand(args.targetId, 'Debugger.stepInto', {}, 3000);
      return { ok: true, stepped: 'into' };
    }
    if (args.action === 'state') {
      // approximate via Runtime.evaluate
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: 'typeof globalThis.__bb_state',
        returnByValue: true,
      }, 3000);
      return { ok: true, state: r.result.value };
    }
    if (args.action === 'remove') {
      await sendPageCommand(args.targetId, 'Debugger.removeBreakpoint', { breakpointId: args.url }, 3000);
      return { ok: true, removed: args.url };
    }
    return { ok: false, error: 'action: break/pause/resume/step/state/remove' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}