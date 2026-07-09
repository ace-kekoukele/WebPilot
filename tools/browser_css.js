// tools/browser_css.js - CSS 操作 (Chrome 150 CSS 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_css';
export const description = 'CSS 操作: getComputedStyle + stylesheet 读取';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'getComputed/matchedFonts' },
  selector: { type: 'string', description: 'CSS selector (getComputed)' },
  properties: { type: 'array', description: '要获取的 CSS 属性列表 (可选, 默认返回全部)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };

    if (args.action === 'getComputed') {
      if (!args.selector) return { ok: false, error: 'selector required' };
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(args.selector)});
          if (!el) return { ok: false, error: 'selector not found' };
          const cs = getComputedStyle(el);
          const props = ${args.properties ? JSON.stringify(args.properties) : 'null'};
          if (props) {
            const out = {};
            for (const p of props) out[p] = cs.getPropertyValue(p);
            return { ok: true, selector: ${JSON.stringify(args.selector)}, styles: out };
          }
          // 全属性 (慢但完整)
          const all = {};
          for (let i = 0; i < cs.length; i++) {
            const p = cs[i];
            all[p] = cs.getPropertyValue(p);
          }
          return { ok: true, selector: ${JSON.stringify(args.selector)}, styles: all, count: cs.length };
        })()`,
        returnByValue: true,
      }, 5000);
      return r.result.value;
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}