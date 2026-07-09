// tools/browser_eval.js - 在 Page 上下文执行 JS
import { evaluate } from '../lib/cdp/index.js';

export const name = 'browser_eval';
export const description = '在指定标签页执行 JS 表达式';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  expression: { type: 'string', description: 'JS 表达式' },
  awaitPromise: { type: 'boolean', description: 'await Promise' },
};

export async function execute(args, ctx) {
  try {
    const r = await evaluate(args.targetId, args.expression, {
      awaitPromise: args.awaitPromise !== false,
      returnByValue: true,
    });
    if (r.error) return { ok: false, error: r.error };
    return { ok: true, value: r.result?.value, type: r.result?.type };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}