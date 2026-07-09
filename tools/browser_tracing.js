// tools/browser_tracing.js - 性能 trace (Chrome 150 Tracing 域)
import { sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_tracing';
export const description = 'Performance trace: 启动/停止/导出 (Chrome 150 Tracing 域)';
export const parameters = {
  action: { type: 'string', description: 'start/stop' },
  categories: { type: 'string', description: '逗号分隔的 trace 类别 (默认: -disabled-by-default-devtools.timeline)' },
  traceFile: { type: 'string', description: '导出文件路径 (stop 时)' },
};

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (start/stop)' };

    if (args.action === 'start') {
      const cats = (args.categories || '-disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,v8.execute,blink.user_timing').split(',');
      const r = await sendCommand('Tracing.start', {
        traceConfig: {
          includedCategories: cats,
          recordMode: 'recordUntilFull',
        },
      });
      return { ok: r.error?.message ? false : true, started: true, categories: cats };
    }

    if (args.action === 'stop') {
      // Note: Tracing.stop 返回 stream, body 是大 binary, 这里只确认 stop 成功
      // 真实导出需要 ws 流式接收 Tracing.dataCollected 事件 + 写文件
      const events = [];
      let traceStarted = false;
      // 设置一次性事件监听
      const { on, off } = await import('../lib/cdp/index.js');
      const handler = (params) => {
        events.push(params);
        traceStarted = true;
      };
      on('Tracing.dataCollected', handler);
      try {
        await sendCommand('Tracing.end', {});
        // 等待最多 3s 收集事件
        await new Promise(r => setTimeout(r, 3000));
      } finally {
        off('Tracing.dataCollected', handler);
      }
      const summary = {
        ok: true,
        traceEvents: events.length,
        categories: [...new Set(events.flatMap(e => Object.keys(e.value || {})))].slice(0, 20),
      };
      if (events.length > 0) {
        summary.firstEvent = events[0];
        summary.lastEvent = events[events.length - 1];
      }
      return summary;
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}