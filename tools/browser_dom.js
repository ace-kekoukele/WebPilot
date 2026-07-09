// tools/browser_dom.js - DOM query
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_dom';
export const description = 'Document object model operations: querySelector, querySelectorAll';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  expression: { type: 'string', description: 'document.querySelector(...).textContent 等' },
};

export async function execute(args, ctx) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await ensureBridge();
    const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: args.expression,
      returnByValue: true,
      awaitPromise: true,
    }, 10000);
    if (r.exceptionDetails) return { ok: false, error: r.exceptionDetails.exception?.description };
    return { ok: true, value: r.result?.value };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}