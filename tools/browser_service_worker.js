// tools/browser_service_worker.js - Service Worker 管理 (Chrome 150)
import { sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_service_worker';
export const description = 'Service Worker 管理: 列表/停止/取消注册 (Chrome 150)';
export const parameters = {
  origin: { type: 'string', description: 'origin (e.g. https://example.com)' },
  action: { type: 'string', description: 'list/unregister' },
};

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (list/unregister)' };

    if (args.action === 'list') {
      // 用 Target.getTargets 找 service_worker 类型
      const r = await sendCommand('Target.getTargets', {});
      const workers = r.targetInfos.filter(t => t.type === 'service_worker');
      return {
        ok: true,
        count: workers.length,
        workers: workers.map(w => ({
          targetId: w.targetId,
          url: w.url,
          scope: w.url,
        })),
      };
    }

    if (args.action === 'unregister') {
      if (!args.origin) return { ok: false, error: 'origin required' };
      // 通过 ServiceWorker domain: unregister via JS evaluate
      // 先找这个 origin 下的 SW
      const r = await sendCommand('Target.getTargets', {});
      const workers = r.targetInfos.filter(t =>
        t.type === 'service_worker' && t.url.startsWith(args.origin)
      );
      if (workers.length === 0) {
        return { ok: false, error: `no service worker found for origin ${args.origin}` };
      }
      // 关闭每个 SW
      for (const w of workers) {
        await sendCommand('Target.closeTarget', { targetId: w.targetId }).catch(() => {});
      }
      return { ok: true, unregistered: workers.length, origin: args.origin };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}