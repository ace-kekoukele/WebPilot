// tools/browser_dom_snapshot.js - DOM 静态快照 (Chrome 150 DOMSnapshot 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_dom_snapshot';
export const description = 'DOM 静态快照: 抓 DOM 树 + CSSOM (Chrome 150 DOMSnapshot 域)';
export const parameters = {
  targetId: { type: 'string' },
  includeStyle: { type: 'boolean', description: '包含 computed style (默认 true, 慢但完整)' },
  includeDOM: { type: 'boolean', description: '包含 DOM 详情 (默认 true)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    await sendPageCommand(args.targetId, 'DOMSnapshot.enable', {}, 3000).catch(() => {});

    const r = await sendPageCommand(args.targetId, 'DOMSnapshot.captureSnapshot', {
      computedStyles: args.includeStyle !== false ? ['display', 'visibility', 'color', 'background-color', 'font-size'] : [],
    }, 15000);

    const docs = r.documents || [];
    const totalNodes = docs.reduce((s, d) => s + (d.nodes?.tree?.nodeCount || 0), 0);

    // 简化输出
    const summary = docs.map(d => ({
      url: d.documentURL,
      nodeCount: d.nodes?.tree?.nodeCount || 0,
      layoutTreeNodeCount: d.layoutTree?.nodeCount || 0,
      textBoxCount: d.textBoxes?.length || 0,
    }));

    return {
      ok: true,
      documentCount: docs.length,
      totalNodes,
      summary,
      // 完整 snapshot 数据较大, 调用方按需取
      full: r,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}