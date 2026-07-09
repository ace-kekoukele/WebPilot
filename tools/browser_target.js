// tools/browser_target.js - Target attach/detach (iframe/service worker)
import { sendCommand, sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_target';
export const description = 'Target attach/detach/send-command (iframe / SW / OOP)';
export const parameters = {
  action: { type: 'string', description: 'list/attach/detach/send_command' },
  targetId: { type: 'string' },
  flatten: { type: 'boolean' },
  method: { type: 'string', description: 'CDP method (send_command)' },
  params: { type: 'object' },
};

export async function execute(args) {
  try {
    await ensureBridge();
    if (args.action === 'list') {
      const r = await sendCommand('Target.getTargets', {});
      return { ok: true, count: r.targetInfos.length, targets: r.targetInfos };
    }
    if (args.action === 'attach') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      const r = await sendCommand('Target.attachToTarget', { targetId: args.targetId, flatten: args.flatten !== false });
      return { ok: true, sessionId: r.sessionId };
    }
    if (args.action === 'detach') {
      const sessionId = args.params?.sessionId;
      if (!sessionId) return { ok: false, error: 'params.sessionId required' };
      await sendCommand('Target.detachFromTarget', { sessionId });
      return { ok: true, detached: sessionId };
    }
    if (args.action === 'send_command') {
      if (!args.targetId || !args.method) return { ok: false, error: 'targetId + method required' };
      const r = await sendPageCommand(args.targetId, args.method, args.params || {}, 10000);
      return { ok: true, result: r };
    }
    return { ok: false, error: 'action: list/attach/detach/send_command' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}