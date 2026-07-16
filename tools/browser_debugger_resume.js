// tools/browser_debugger_resume.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_debugger_resume';
export const description = 'Resume paused execution';
export const parameters = { targetId: { type: 'string' } };

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Debugger.resume', {}, 3000);
    return { ok: true, resumed: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}