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
      const events = [];
      let traceStarted = false;
      // 设置事件监听
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

      // 导出到文件（如果指定了 traceFile）
      let exportPath = null;
      let exportSize = 0;
      if (args.traceFile && events.length > 0) {
        try {
          const fs = await import('node:fs');
          const path = await import('node:path');
          const dir = path.dirname(args.traceFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          // 构造标准 trace 格式的 JSON（兼容 Chrome DevTools Performance 面板）
          const traceChunks = events.map(e => e.value).filter(Boolean);
          const json = JSON.stringify({
            traceEvents: traceChunks.flat(),
            metadata: {
              'webpilot-version': '4.0.5',
              collectedAt: new Date().toISOString(),
              eventCount: traceChunks.reduce((s, c) => s + (Array.isArray(c) ? c.length : 1), 0),
            },
          }, null, 2);
          fs.writeFileSync(args.traceFile, json, 'utf-8');
          exportPath = args.traceFile;
          exportSize = Buffer.byteLength(json, 'utf-8');
        } catch (fsErr) {
          // 文件写入失败不阻断返回
          exportPath = null;
        }
      }

      return {
        ok: true,
        traceEvents: events.length,
        exported: exportPath ? { path: exportPath, size: exportSize } : null,
        categories: [...new Set(events.flatMap(e => Object.keys(e.value || {})))].slice(0, 20),
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}