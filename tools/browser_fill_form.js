// tools/browser_fill_form.js - 批量填充表单
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_fill_form';
export const description = '批量填充多字段表单';
export const parameters = {
  targetId: { type: 'string' },
  fields: { type: 'array', description: '[{selector, value}]' },
};

export async function execute(args) {
  if (!Array.isArray(args.fields)) return { ok: false, error: 'fields must be array' };
  try {
    const exp = `(async () => {
      const results = [];
      for (const f of ${JSON.stringify(args.fields)}) {
        const el = document.querySelector(f.selector);
        if (!el) { results.push({ selector: f.selector, ok: false, error: 'not found' }); continue; }
        el.value = f.value;
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        results.push({ selector: f.selector, ok: true });
      }
      return { ok: true, count: results.length, results };
    })()`;
    const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true }, 30000);
    return r.result.value;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}