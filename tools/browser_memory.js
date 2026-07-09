// tools/browser_memory.js - 内存状态查询 + 压力模拟 (Chrome 150 Memory 域)
import { sendPageCommand, sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_memory';
export const description = '内存状态查询 + 压力模拟 (Chrome 150 Memory 域)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'current/pressure/startSampling/stopSampling' },
  level: { type: 'string', description: 'pressure level: moderate/critical (startSampling)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (current/pressure/startSampling/stopSampling)' };

    if (args.action === 'current') {
      // 用 Runtime 拿 performance.memory
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          usagePct: Math.round(performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100),
        } : null`,
        returnByValue: true,
      }, 5000);
      return { ok: true, memory: r.result.value };
    }

    if (args.action === 'pressure') {
      await sendPageCommand(args.targetId, 'Memory.enable', {}, 3000).catch(() => {});
      // getDOMCounters
      try {
        const r = await sendPageCommand(args.targetId, 'Memory.getDOMCounters', {}, 5000);
        return { ok: true, dom: r };
      } catch {
        // fallback: 用 Runtime
        const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
          expression: `({
            documents: document.getElementsByTagName('*').length,
            listeners: (window.getEventListeners ? Object.keys(window.getEventListeners(document)).length : 'n/a'),
          })`,
          returnByValue: true,
        }, 5000);
        return { ok: true, fallback: r.result.value };
      }
    }

    if (args.action === 'startSampling') {
      await sendPageCommand(args.targetId, 'Memory.startSampling', { samplingInterval: 32768 }, 5000);
      return { ok: true, started: true };
    }

    if (args.action === 'stopSampling') {
      // stopSampling 返回 profile (binary data), 这里只确认停止
      // 真实采样数据需要走 binary transfer
      try {
        await sendPageCommand(args.targetId, 'Memory.stopSampling', {}, 10000);
        return { ok: true, stopped: true, note: 'profile data streamed to CDP (not collected)' };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}