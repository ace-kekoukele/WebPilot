// tools/browser_snapshot.js - 获取页面 AX tree 简化版
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_snapshot';
export const description = '获取页面的 accessibility tree (accessibleName + role)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  depth: { type: 'number', description: 'AX tree 深度 (默认 3)' },
};

export async function execute(args, ctx) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await ensureBridge();
    await sendPageCommand(args.targetId, 'Accessibility.enable', {}, 5000);
    const r = await sendPageCommand(args.targetId, 'Accessibility.getFullAXTree', {}, 10000);
    const nodes = (r.nodes || []).map((n) => ({
      nodeId: n.nodeId,
      role: n.role?.value,
      name: n.name?.value,
      value: n.value?.value,
      description: n.description?.value,
    }));
    return { ok: true, count: nodes.length, nodes: nodes.slice(0, 200) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}