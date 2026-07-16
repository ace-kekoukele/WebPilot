// tools/browser_click.js — 点击页面元素（支持选择器和坐标）
import { sendPageCommand, evaluate } from '../lib/cdp/index.js';

export const name = 'browser_click';
export const description = '点击页面元素（支持 CSS 选择器或 X/Y 坐标）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  selector: { type: 'string', description: 'CSS 选择器（优先级高于坐标）' },
  x: { type: 'number', description: 'X 坐标（selector 为空时使用）' },
  y: { type: 'number', description: 'Y 坐标（selector 为空时使用）' },
  button: { type: 'string', description: '鼠标按钮: left/right/middle（默认 left）' },
  clickCount: { type: 'number', description: '点击次数（默认 1）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.selector && (args.x === undefined || args.y === undefined)) {
      return { ok: false, error: 'selector 或 x/y 坐标至少需要提供一个' };
    }

    let x = args.x;
    let y = args.y;

    if (args.selector) {
      // 解析选择器获取元素中心坐标
      const pos = await evaluate(args.targetId, `(sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          tag: el.tagName,
          visible: rect.width > 0 && rect.height > 0
        };
      }`, { args: [args.selector], returnByValue: true });

      const v = pos?.result?.value;
      if (!v) return { ok: false, error: `元素未找到: ${args.selector}` };
      if (!v.visible) return { ok: false, error: `元素不可见: ${args.selector} (${v.w}x${v.h})` };

      x = v.x;
      y = v.y;

      // 滚动元素到可见区域
      await evaluate(args.targetId, `(sel) => {
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }`, { args: [args.selector], returnByValue: false });
    }

    const buttonMap = { left: 0, right: 1, middle: 2 };
    const button = buttonMap[args.button] ?? 0;
    const clickCount = args.clickCount || 1;

    // MousePressed
    await sendPageCommand(args.targetId, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x, y, button, clickCount, modifiers: 0,
    }, 5000);

    // MouseReleased
    await sendPageCommand(args.targetId, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x, y, button, clickCount, modifiers: 0,
    }, 5000);

    return { ok: true, x: Math.round(x), y: Math.round(y), button: args.button || 'left', clickCount };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
