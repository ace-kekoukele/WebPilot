// tools/browser_eval.js — 在 Page 上下文执行 JS（v4.0.4 安全增强版）
import { evaluate } from '../lib/cdp/index.js';

// 禁止的危险模式
const FORBIDDEN = [
  /\bwhile\s*\(/,           // 无限循环
  /\bfor\s*\(\s*;/,         // 无限 for
  /\btimeout\b/i,           // setTimeout
  /\binterval\b/i,          // setInterval
  /\brequestAnimationFrame\b/,
  /\beval\b/,              // 嵌套 eval
  /\bFunction\b/,           // Function 构造器
  /\bimport\s*\(/,          // 动态 import
  /\brequire\s*\(/,         // require
  /\bprocess\b/,            // Node.js process
  /\bglobal\b/,             // 全局对象
  /\bwindow\.open\b/,
  /\bdocument\.write\b/,
  /\balert\s*\(/,
  /\bconfirm\s*\(/,
  /\bprompt\s*\(/,
];

export const name = 'browser_eval';
export const description = '在指定标签页执行 JS 表达式（v4.0.4 安全增强）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  expression: { type: 'string', description: 'JS 表达式' },
  awaitPromise: { type: 'boolean', description: 'await Promise（默认 true）' },
  bypassSafety: { type: 'boolean', description: '跳过安全检查（谨慎使用）' },
};

export async function execute(args) {
  try {
    if (!args.bypassSafety) {
      for (const pat of FORBIDDEN) {
        if (pat.test(args.expression)) {
          return { ok: false, error: `表达式包含禁止的模式: ${pat}` };
        }
      }
    }
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
