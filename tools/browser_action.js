// tools/browser_action.js - 点击/填充/输入 (简化的统一 action)
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_action';
export const description = '页面交互: click / fill / type / hover';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'click / fill / type / hover' },
  selector: { type: 'string', description: 'CSS selector' },
  value: { type: 'string', description: 'fill / type 的文本' },
};

export async function execute(args, ctx) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };
    if (!args.selector) return { ok: false, error: 'selector required' };
    await ensureBridge();

    if (args.action === 'click' || args.action === 'hover') {
      const exp = `(() => { const el = document.querySelector(${JSON.stringify(args.selector)}); if (!el) return { ok: false, error: 'not found' }; el.scrollIntoView(); el.dispatchEvent(new MouseEvent('${args.action}', {bubbles:true})); return { ok: true }; })()`;
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: exp, returnByValue: true,
      }, 5000);
      return { ok: r.result.value?.ok !== false, error: r.result.value?.error };
    }

    if (args.action === 'fill') {
      const v = JSON.stringify(args.value || '');
      const exp = `(async () => { const el = document.querySelector(${JSON.stringify(args.selector)}); if (!el) return { ok: false, error: 'not found' }; el.value = ${v}; el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); return { ok: true }; })()`;
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: exp, returnByValue: true, awaitPromise: true,
      }, 5000);
      return { ok: r.result.value?.ok !== false, error: r.result.value?.error };
    }

    if (args.action === 'type') {
      // simulated keystroke via DOM
      const chars = JSON.stringify(args.value || '');
      const exp = `(() => { const el = document.querySelector(${JSON.stringify(args.selector)}); if (!el) return { ok: false, error: 'not found' }; for (const c of ${chars}) { el.value = (el.value || '') + c; el.dispatchEvent(new KeyboardEvent('keydown',{key:c,bubbles:true})); el.dispatchEvent(new KeyboardEvent('keypress',{key:c,bubbles:true})); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new KeyboardEvent('keyup',{key:c,bubbles:true})); } return { ok: true, length: ${chars.length} }; })()`;
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: exp, returnByValue: true,
      }, 5000);
      return { ok: r.result.value?.ok !== false, length: args.value?.length };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}