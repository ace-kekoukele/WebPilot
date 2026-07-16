// tools/browser_layer_tree.js - 图层信息 (Chrome 150 LayerTree 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_layer_tree';
export const description = '图层树查询: 合成层 + 性能调试 (Chrome 150 LayerTree 域)';
export const parameters = {
  targetId: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    await sendPageCommand(args.targetId, 'LayerTree.enable', {}, 3000).catch(() => {});

    // 先 snapshot 拿当前 layer tree
    const r = await sendPageCommand(args.targetId, 'LayerTree.compositingReasons', {}, 5000);

    // 用 Page.getLayoutMetrics 配合查 layer info
    const layout = await sendPageCommand(args.targetId, 'Page.getLayoutMetrics', {}, 5000);

    return {
      ok: true,
      compositingReasons: r.compositingReasons || [],
      layerCount: (r.compositingReasons || []).length,
      layout: {
        contentSize: layout.cssContentSize || layout.contentSize,
        viewport: layout.cssVisualViewport || layout.visualViewport,
      },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}