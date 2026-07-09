// tools/browser_type.js — 在输入框中输入文本（支持特殊键和延迟）
import { sendPageCommand, evaluate } from '../lib/cdp/index.js';

export const name = 'browser_type';
export const description = '在输入框中输入文本（支持每个字符延迟、按 Enter）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  selector: { type: 'string', description: '输入框 CSS 选择器' },
  text: { type: 'string', description: '要输入的文本' },
  delay: { type: 'number', description: '每个字符延迟毫秒（默认 0）' },
  clear: { type: 'boolean', description: '输入前清空现有内容（默认 true）' },
  pressEnter: { type: 'boolean', description: '输入完成后按回车（默认 false）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.selector) return { ok: false, error: 'selector required' };
    if (args.text === undefined) return { ok: false, error: 'text required' };

    // 确保元素存在且可聚焦
    const focus = await evaluate(args.targetId, `(sel) => {
      const el = document.querySelector(sel);
      if (!el) return { ok: false, error: 'not found' };
      el.focus();
      return { ok: true, tag: el.tagName, type: el.type };
    }`, { args: [args.selector], returnByValue: true });

    const fv = focus?.result?.value;
    if (!fv?.ok) return { ok: false, error: fv?.error || `无法聚焦: ${args.selector}` };

    // 清空现有内容
    if (args.clear !== false) {
      await evaluate(args.targetId, `(sel) => {
        const el = document.querySelector(sel);
        if (el) {
          el.value = '';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }`, { args: [args.selector], returnByValue: false });
    }

    // 分字符输入
    const chars = args.text.split('');
    for (let i = 0; i < chars.length; i++) {
      await evaluate(args.targetId, `(sel, ch) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        el.value += ch;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }`, { args: [args.selector, chars[i]], returnByValue: true });

      if (args.delay > 0) {
        await new Promise((r) => setTimeout(r, args.delay));
      }
    }

    // 按回车
    if (args.pressEnter) {
      await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', {
        type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, 3000);
      await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', {
        type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13,
      }, 3000);
    }

    return { ok: true, selector: args.selector, textLength: args.text.length, pressEnter: args.pressEnter || false };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
