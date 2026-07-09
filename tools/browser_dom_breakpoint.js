// tools/browser_dom_breakpoint.js - DOM 修改断点 (Chrome 150 DOMDebugger 增强)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_dom_breakpoint';
export const description = 'DOM 修改断点: 子树/属性/节点删除时暂停 (Chrome 150 DOMDebugger 增强)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'setSubtree/setAttribute/setNodeRemoval/remove' },
  selector: { type: 'string', description: 'CSS selector (要监听 DOM 变化的元素)' },
  attributeName: { type: 'string', description: '属性名 (setAttribute 时)' },
  nodeId: { type: 'number', description: 'backend node ID (remove 时)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };

    await sendPageCommand(args.targetId, 'DOMDebugger.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'DOM.enable', {}, 3000).catch(() => {});

    if (args.action === 'setSubtree') {
      if (!args.selector) return { ok: false, error: 'selector required' };
      const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,
        selector: args.selector,
      }, 5000);
      if (!r.nodeId) return { ok: false, error: 'selector not found' };
      await sendPageCommand(args.targetId, 'DOMDebugger.setDOMBreakpoint', {
        nodeId: r.nodeId,
        type: 'subtree-modified',
      }, 5000);
      return { ok: true, breakpoint: 'subtree-modified', selector: args.selector };
    }

    if (args.action === 'setAttribute') {
      if (!args.selector || !args.attributeName) {
        return { ok: false, error: 'selector + attributeName required' };
      }
      const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,
        selector: args.selector,
      }, 5000);
      if (!r.nodeId) return { ok: false, error: 'selector not found' };
      await sendPageCommand(args.targetId, 'DOMDebugger.setDOMBreakpoint', {
        nodeId: r.nodeId,
        type: 'attribute-modified',
        attributeName: args.attributeName,
      }, 5000);
      return { ok: true, breakpoint: 'attribute-modified', selector: args.selector, attribute: args.attributeName };
    }

    if (args.action === 'setNodeRemoval') {
      if (!args.selector) return { ok: false, error: 'selector required' };
      const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,
        selector: args.selector,
      }, 5000);
      if (!r.nodeId) return { ok: false, error: 'selector not found' };
      await sendPageCommand(args.targetId, 'DOMDebugger.setDOMBreakpoint', {
        nodeId: r.nodeId,
        type: 'node-removed',
      }, 5000);
      return { ok: true, breakpoint: 'node-removed', selector: args.selector };
    }

    if (args.action === 'remove') {
      if (!args.selector) return { ok: false, error: 'selector required' };
      const r = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,
        selector: args.selector,
      }, 5000);
      if (!r.nodeId) return { ok: false, error: 'selector not found' };
      await sendPageCommand(args.targetId, 'DOMDebugger.removeDOMBreakpoint', {
        nodeId: r.nodeId,
        type: 'subtree-modified',
      }, 5000);
      return { ok: true, removed: 'subtree-modified', selector: args.selector };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}