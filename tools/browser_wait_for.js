// tools/browser_wait_for.js - 等元素/文字
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_wait_for';
export const description = 'Wait for element by CSS selector / text content';
export const parameters = {
  targetId: { type: 'string' },
  text: { type: 'array', description: 'texts to wait for' },
  selector: { type: 'string', description: 'CSS selector' },
  uid: { type: 'string', description: 'uid reference (from snapshot)' },
  timeout: { type: 'number' },
};

export async function execute(args) {
  const timeout = args.timeout || 30000;
  const start = Date.now();
  try {
    while (Date.now() - start < timeout) {
      const parts = [];
      if (args.selector) parts.push(`!!document.querySelector(${JSON.stringify(args.selector)})`);
      if (Array.isArray(args.text)) {
        const items = JSON.stringify(args.text);
        parts.push(`document.body && ${items}.every(t => document.body.innerText.includes(t))`);
      }
      const cond = parts.length > 0 ? parts.join(' || ') : 'document.readyState === "complete"';
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', { expression: cond, returnByValue: true }, 5000);
      if (r.result.value === true) return { ok: true, elapsedMs: Date.now() - start };
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ok: false, error: `timeout ${timeout}ms`, elapsedMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}