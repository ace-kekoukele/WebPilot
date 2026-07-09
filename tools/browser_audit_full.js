// tools/browser_audit_full.js - 完整审计 (Chrome 150 Audits 增强)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_audit_full';
export const description = '完整页面审计: 性能指标 + 资源 + 内存 (Chrome 150 Audits 域增强)';
export const parameters = {
  targetId: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };

    await sendPageCommand(args.targetId, 'Audits.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Performance.enable', {}, 3000).catch(() => {});

    // 抓完整 metrics
    const metrics = await sendPageCommand(args.targetId, 'Performance.getMetrics', {}, 10000);

    // 资源大小
    const resources = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `performance.getEntriesByType('resource').map(r => ({
        name: r.name,
        transferSize: r.transferSize,
        decodedBodySize: r.decodedBodySize,
        duration: r.duration,
        type: r.initiatorType,
      }))`,
      returnByValue: true,
    }, 10000);

    // DOM 节点数
    const dom = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `({
        total: document.getElementsByTagName('*').length,
        scripts: document.scripts.length,
        styles: document.querySelectorAll('style, link[rel=stylesheet]').length,
        images: document.images.length,
        iframes: document.querySelectorAll('iframe').length,
      })`,
      returnByValue: true,
    }, 5000);

    // 内存
    const mem = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      } : null`,
      returnByValue: true,
    }, 5000);

    // 解析 metrics 为友好格式
    const metricMap = {};
    for (const m of (metrics.metrics || [])) {
      metricMap[m.name] = m.value;
    }

    return {
      ok: true,
      metrics: {
        domContentLoaded: metricMap.DomContentLoaded,
        domInteractive: metricMap.DomInteractive,
        layoutCount: metricMap.LayoutCount,
        layoutDuration: metricMap.LayoutDuration,
        scriptDuration: metricMap.ScriptDuration,
        taskDuration: metricMap.TaskDuration,
        usedJsHeapSize: metricMap.UsedJSHeapSize,
        totalJsHeapSize: metricMap.TotalJSHeapSize,
      },
      dom: dom.result.value,
      memory: mem.result.value,
      resourceCount: resources.result.value?.length || 0,
      topResources: (resources.result.value || [])
        .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
        .slice(0, 10),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}