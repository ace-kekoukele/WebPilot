// tools/browser_audits.js - Lighthouse-style 性能审计 (Chrome 150)
import { sendCommand, sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_audits';
export const description = 'Performance/SEO/Accessibility 审计 (Chrome 150 Audits 域)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  category: { type: 'string', description: 'performance/accessibility/seo/best-practices (默认 performance)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    const cat = args.category || 'performance';
    await sendPageCommand(args.targetId, 'Audits.enable', {}, 3000).catch(() => {});

    // 获取关键 metrics
    const r = await sendPageCommand(args.targetId, 'Audits.getEncodedResponse', {
      requestId: args.targetId,
      encoding: 'webp',
    }).catch(() => null);

    // 简单 metric: 用 Runtime 拿 PerformanceNavigationTiming
    const nav = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
      expression: `(() => {
        const t = performance.getEntriesByType('navigation')[0];
        if (!t) return null;
        return {
          domContentLoaded: t.domContentLoadedEventEnd - t.startTime,
          load: t.loadEventEnd - t.startTime,
          firstByte: t.responseStart - t.startTime,
          domInteractive: t.domInteractive - t.startTime,
          resources: performance.getEntriesByType('resource').length,
        };
      })()`,
      returnByValue: true,
    }, 5000);

    return {
      ok: true,
      category: cat,
      navigation: nav.result.value,
      note: 'Use Audits domain for full Lighthouse report; this gives core nav timings',
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}