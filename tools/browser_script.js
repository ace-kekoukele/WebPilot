// tools/browser_script.js - 脚本源码 (list / get / search)
import { sendPageCommand } from '../lib/cdp/index.js';

const _scripts = new Map(); // targetId -> {scriptId: {url, ...}}

export const name = 'browser_script';
export const description = '页面加载的脚本源码操作 (list/get/search)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'list/get/search' },
  scriptId: { type: 'string' },
  query: { type: 'string' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    await sendPageCommand(args.targetId, 'Debugger.enable', {}, 5000).catch(() => {});
    const scripts = Object.values(_scripts.get(args.targetId) || {});
    if (args.action === 'list') {
      return { ok: true, count: scripts.length, scripts };
    }
    if (args.action === 'get') {
      if (!args.scriptId) return { ok: false, error: 'scriptId required' };
      const meta = (_scripts.get(args.targetId) || {})[args.scriptId];
      if (!meta) return { ok: false, error: 'script not found' };
      const r = await sendPageCommand(args.targetId, 'Debugger.getScriptSource', { scriptId: args.scriptId }, 10000);
      return { ok: true, scriptId: args.scriptId, url: meta.url, source: r.scriptSource };
    }
    if (args.action === 'search') {
      if (!args.query) return { ok: false, error: 'query required' };
      const hits = [];
      for (const s of scripts) {
        try {
          const r = await sendPageCommand(args.targetId, 'Debugger.getScriptSource', { scriptId: s.scriptId }, 10000);
          if (r.scriptSource && r.scriptSource.includes(args.query)) {
            hits.push({ scriptId: s.scriptId, url: s.url, matchLength: (r.scriptSource.match(new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length });
          }
        } catch {}
      }
      return { ok: true, hits };
    }
    return { ok: false, error: 'action: list/get/search' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export const _scripts_map = _scripts;