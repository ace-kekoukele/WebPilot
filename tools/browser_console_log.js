// tools/browser_console_log.js - Console 拦截 + 严重性过滤 (Chrome 150 Log 域)
import { on } from '../lib/cdp/index.js';
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_console_log';
export const description = 'Console 拦截 + 严重性过滤 (Chrome 150 Log 域)';
export const parameters = {
  targetId: { type: 'string' },
  minLevel: { type: 'string', description: '最低级别: verbose/info/warning/error (默认 info)' },
  collectMs: { type: 'number', description: '收集时长 ms (默认 5000)' },
};

const LEVELS = { verbose: 0, info: 1, warning: 2, error: 3 };

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    const minLevel = LEVELS[args.minLevel || 'info'] ?? 1;
    const collectMs = args.collectMs || 5000;

    await sendPageCommand(args.targetId, 'Log.enable', {}, 3000).catch(() => {});
    await sendPageCommand(args.targetId, 'Runtime.enable', {}, 3000).catch(() => {});

    const logs = [];
    const offConsole = on('Runtime.consoleAPICalled', (params, sessionId) => {
      const level = params.type || 'info';
      const lvlNum = LEVELS[level] ?? 1;
      if (lvlNum >= minLevel) {
        logs.push({
          type: level,
          args: (params.args || []).map(a => a.value || a.description || JSON.stringify(a)),
          url: params.stackTrace?.callFrames?.[0]?.url,
        });
      }
    });
    const offLog = on('Log.entryAdded', (params) => {
      const level = params.entry?.level || 'info';
      const lvlNum = LEVELS[level] ?? 1;
      if (lvlNum >= minLevel) {
        logs.push({
          type: level,
          text: params.entry?.text,
          source: params.entry?.source,
          url: params.entry?.url,
        });
      }
    });

    try {
      await new Promise(r => setTimeout(r, collectMs));
    } finally {
      offConsole();
      offLog();
    }

    return {
      ok: true,
      minLevel: args.minLevel || 'info',
      collectMs,
      logCount: logs.length,
      logs,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}