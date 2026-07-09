// tools/browser_press_key.js - 按键
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_press_key';
export const description = '按单个键 (Enter/Tab/Escape/...)';
export const parameters = {
  targetId: { type: 'string' },
  key: { type: 'string', description: 'Enter/Tab/Escape/ArrowUp/...' },
  modifier: { type: 'string', description: 'ctrl/alt/shift/meta (可选)' },
};

export async function execute(args) {
  try {
    if (!args.key) return { ok: false, error: 'key required' };
    const mods = [];
    if (args.modifier) {
      for (const m of String(args.modifier).split(',')) {
        const v = m.trim();
        if (v === 'ctrl') mods.push(1);
        else if (v === 'alt') mods.push(2);
        else if (v === 'shift') mods.push(8);
        else if (v === 'meta') mods.push(4);
      }
    }
    const opts = {
      type: 'keyDown',
      key: args.key,
      code: args.key,
      windowsVirtualKeyCode: 0,
      modifiers: mods.reduce((a, b) => a | b, 0),
    };
    await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', opts, 5000);
    await sendPageCommand(args.targetId, 'Input.dispatchKeyEvent', { ...opts, type: 'keyUp' }, 5000);
    return { ok: true, key: args.key };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}