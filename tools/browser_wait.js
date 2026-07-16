// tools/browser_wait.js - 轮询条件
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_wait';
export const description = '轮询等待页面 JavaScript 条件为 true';
export const parameters = {
  targetId: { type: 'string' },
  condition: { type: 'string', description: 'JS 表达式 (返回 truthy)' },
  timeout: { type: 'number', description: 'ms (默认 30000)' },
  interval: { type: 'number', description: 'check ms (默认 200)' },
};

export async function execute(args) {
  const timeout = args.timeout || 30000;
  const interval = args.interval || 200;
  const start = Date.now();
  try {
    while (Date.now() - start < timeout) {
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `!!(${args.condition})`, returnByValue: true,
      }, 5000);
      if (r.result.value === true) return { ok: true, elapsedMs: Date.now() - start };
      await new Promise((r) => setTimeout(r, interval));
    }
    return { ok: false, error: `timeout ${timeout}ms`, elapsedMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}