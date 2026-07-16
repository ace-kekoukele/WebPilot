// tools/browser_dialog.js - 处理 alert/confirm/prompt
import { sendPageCommand } from '../lib/cdp/index.js';

const _pending = new Map(); // targetId -> { dialog, type, defaultPrompt }

export const name = 'browser_dialog';
export const description = '预设置弹窗处理 (accept/dismiss/clear) — 弹窗后自动应用';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'accept/dismiss/clear' },
  promptText: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (args.action === 'clear') {
      _pending.delete(args.targetId);
      return { ok: true, cleared: true };
    }
    if (!['accept', 'dismiss'].includes(args.action)) {
      return { ok: false, error: 'action must be accept/dismiss/clear' };
    }
    _pending.set(args.targetId, { action: args.action, promptText: args.promptText });
    // Page.enable to ensure dialog event fires
    try { await sendPageCommand(args.targetId, 'Page.enable', {}, 3000); } catch {}
    return { ok: true, action: args.action, promptText: args.promptText || '' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _internal_pending = _pending;

// ──── tab close cleanup (Step 1 of 70-tools 8-step refactor) ──────
// _pending Map 之前会无限增长 — 现在 tab 关闭时清理。
// 由 daemon/module-cleanup.js (Step 2) 在 CDP Target.targetDestroyed 时调用。
export function _onTabClose(targetId) {
  _pending.delete(targetId);
}

// debug-only hook for memory-guard
export function _internal_stats() {
  return {
    module: 'browser_dialog',
    pendingEntries: _pending.size,
  };
}