// tools/browser_hover.js
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_hover';
export const description = 'Hover element via mouseMoved';
export const parameters = { targetId: { type: 'string' }, selector: { type: 'string' } };

export async function execute(args) {
  try {
    const exp = `(() => { const el = document.querySelector(${JSON.stringify(args.selector)}); if (!el) return { ok: false, error: 'not found' }; el.scrollIntoView(); const r = el.getBoundingClientRect(); return { ok: true, x: r.left + r.width/2, y: r.top + r.height/2 }; })()`;
    const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', { expression: exp, returnByValue: true }, 5000);
    if (!r.result.value.ok) return r.result.value;
    const { x, y } = r.result.value;
    await sendPageCommand(args.targetId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, 5000);
    return { ok: true, x, y };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}