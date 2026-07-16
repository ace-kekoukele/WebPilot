// tools/browser_css_coverage.js - CSS 覆盖率分析 (Chrome 150 CSSCoverage)
import { sendPageCommand, sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_css_coverage';
export const description = 'CSS 覆盖率: 找出未使用的 CSS 规则 (Chrome 150 CSSCoverage)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'start/stop' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (start/stop)' };

    if (args.action === 'start') {
      await sendPageCommand(args.targetId, 'CSS.enable', {}, 3000).catch(() => {});
      await sendPageCommand(args.targetId, 'CSS.startRuleUsageTracking', {}, 5000);
      return { ok: true, started: true };
    }

    if (args.action === 'stop') {
      await sendPageCommand(args.targetId, 'CSS.stopRuleUsageTracking', {}, 5000);
      // CSSCoverage.takeCoverage 是 browser-level
      const r = await sendCommand('CSSCoverage.takeCoverage', {}, 10000);
      const entries = r.coverage || [];
      const unused = entries.filter(e => e.usedRanges && e.usedRanges.length === 0);
      const usedBytes = entries.reduce((s, e) => s + (e.usedRanges || []).reduce((a, rr) => a + rr.endOffset - rr.startOffset, 0), 0);
      const totalBytes = entries.reduce((s, e) => s + (e.text?.length || 0), 0);
      return {
        ok: true,
        ruleCount: entries.length,
        unusedRuleCount: unused.length,
        usedBytes,
        totalBytes,
        usagePct: totalBytes > 0 ? Math.round(usedBytes / totalBytes * 100) : 0,
        note: `${unused.length}/${entries.length} 规则完全未使用, ${100 - Math.round(usedBytes / totalBytes * 100)}% CSS 死代码`,
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}