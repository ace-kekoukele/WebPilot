// tools/browser_drag.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_drag';
export const description = '拖拽 (mouse.move + drag)';
export const parameters = {
  targetId: { type: 'string' },
  fromSelector: { type: 'string' },
  toSelector: { type: 'string' },
};

export async function execute(args) {
  try {
    const exp = `(async () => {
      const fromRect = document.querySelector(${JSON.stringify(args.fromSelector)})?.getBoundingClientRect();
      const toRect = document.querySelector(${JSON.stringify(args.toSelector)})?.getBoundingClientRect();
      if (!fromRect || !toRect) return { ok: false, error: 'selector not found' };
      const from = { x: fromRect.left + fromRect.width/2, y: fromRect.top + fromRect.height/2 };
      const to = { x: toRect.left + toRect.width/2, y: toRect.top + toRect.height/2 };
      return { ok: true, from, to };
    })()`;
    const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true }, 5000);
    return { ok: r.result.value.ok, from: r.result.value.from, to: r.result.value.to };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}