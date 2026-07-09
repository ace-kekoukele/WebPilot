// tools/browser_a11y.js - 无障碍树查询 (Chrome 150 Accessibility 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_a11y';
export const description = '无障碍树查询 + 元素 a11y 属性 (Chrome 150 Accessibility 域)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'tree/partial/findIssues' },
  selector: { type: 'string', description: 'CSS selector (用于 partial)' },
  depth: { type: 'number', description: '树深度 (默认 3)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (tree/partial/findIssues)' };

    await sendPageCommand(args.targetId, 'Accessibility.enable', {}, 3000).catch(() => {});

    if (args.action === 'tree') {
      const depth = args.depth || 3;
      const r = await sendPageCommand(args.targetId, 'Accessibility.getFullAXTree', {}, 10000);
      return {
        ok: true,
        depth,
        totalNodes: r.nodes?.length || 0,
        roots: (r.nodes || []).filter(n => !n.parentId).map(n => ({
          nodeId: n.nodeId,
          role: n.role?.value,
          name: n.name?.value,
          childCount: n.childIds?.length || 0,
        })),
      };
    }

    if (args.action === 'partial') {
      if (!args.selector) return { ok: false, error: 'selector required for partial' };
      // 先找到 node
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(args.selector)});
          if (!el) return null;
          return { backendNodeId: el.__backendNodeId__ || null };
        })()`,
        returnByValue: true,
      }, 5000);
      if (!r.result.value) return { ok: false, error: 'selector not found' };
      // 直接通过 DOM.querySelector 拿 backendNodeId
      const r2 = await sendPageCommand(args.targetId, 'DOM.querySelector', {
        nodeId: 0,  // document
        selector: args.selector,
      }, 5000);
      if (!r2.nodeId) return { ok: false, error: 'selector not found in DOM' };
      const ax = await sendPageCommand(args.targetId, 'Accessibility.getPartialAXTree', {
        nodeId: r2.nodeId,
        fetchRelatives: false,
      }, 5000);
      return {
        ok: true,
        selector: args.selector,
        nodes: (ax.nodes || []).map(n => ({
          role: n.role?.value,
          name: n.name?.value,
          value: n.value?.value,
          description: n.description?.value,
          properties: (n.properties || []).map(p => ({ name: p.name, value: p.value?.value })),
        })),
      };
    }

    if (args.action === 'findIssues') {
      // 找常见 a11y 问题: 缺 alt, 缺 aria-label, 缺 role, 缺 lang
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const issues = [];
          // 图片缺 alt
          document.querySelectorAll('img').forEach(img => {
            if (!img.hasAttribute('alt')) issues.push({ type: 'img-no-alt', tag: img.outerHTML.slice(0, 100) });
          });
          // button 缺可访问名
          document.querySelectorAll('button').forEach(btn => {
            const text = (btn.textContent || '').trim();
            const aria = btn.getAttribute('aria-label');
            if (!text && !aria) issues.push({ type: 'button-no-name', tag: btn.outerHTML.slice(0, 100) });
          });
          // input 缺 label
          document.querySelectorAll('input, textarea, select').forEach(inp => {
            const id = inp.id;
            const aria = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
            const hasLabel = id && document.querySelector('label[for="' + id + '"]');
            if (!hasLabel && !aria) issues.push({ type: 'input-no-label', tag: inp.outerHTML.slice(0, 100) });
          });
          // html 缺 lang
          if (!document.documentElement.hasAttribute('lang')) {
            issues.push({ type: 'html-no-lang', tag: '<html>' });
          }
          return issues;
        })()`,
        returnByValue: true,
      }, 10000);
      return { ok: true, issueCount: r.result.value.length, issues: r.result.value };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}