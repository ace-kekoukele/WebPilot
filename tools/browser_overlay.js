// tools/browser_overlay.js - DOM Overlay (高亮/调试) (Chrome 150 Overlay 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_overlay';
export const description = 'DOM Overlay 控制: 高亮/查询布局 (Chrome 150 Overlay 域)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'enable/disable/highlight/getLayoutMetrics' },
  selector: { type: 'string', description: 'CSS selector (highlight 时)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (enable/disable/highlight/getLayoutMetrics)' };

    if (args.action === 'enable') {
      await sendPageCommand(args.targetId, 'Overlay.enable', {}, 3000);
      return { ok: true, enabled: true };
    }

    if (args.action === 'disable') {
      await sendPageCommand(args.targetId, 'Overlay.disable', {}, 3000);
      return { ok: true, disabled: true };
    }

    if (args.action === 'highlight') {
      if (!args.selector) return { ok: false, error: 'selector required for highlight' };
      await sendPageCommand(args.targetId, 'Overlay.enable', {}, 3000);
      // 先找到 nodeId
      const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,
        selector: args.selector,
      }, 5000);
      if (!r.nodeId) return { ok: false, error: 'selector not found' };
      // 高亮
      await sendPageCommand(args.targetId, 'Overlay.highlightNode', {
        nodeId: r.nodeId,
        highlightConfig: {
          border: { color: { r: 255, g: 0, b: 0, a: 1 }, width: 2 },
          content: { color: { r: 255, g: 0, b: 0, a: 0.2 } },
        },
      }, 5000);
      return { ok: true, highlighted: args.selector };
    }

    if (args.action === 'getLayoutMetrics') {
      await sendPageCommand(args.targetId, 'Overlay.enable', {}, 3000);
      const r = await sendPageCommand(args.targetId, 'Page.getLayoutMetrics', {}, 5000);
      return {
        ok: true,
        layout: {
          contentSize: r.cssContentSize || r.contentSize,
          viewportSize: r.cssVisualViewport || r.visualViewport,
        },
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}