// tools/browser_cache_storage.js - Cache Storage 管理 (Chrome 150 CacheStorage)
import { sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_cache_storage';
export const description = 'Cache Storage 管理: 列出 cache / entries / 删除 (Chrome 150 CacheStorage 域)';
export const parameters = {
  origin: { type: 'string', description: 'origin (e.g. https://example.com)' },
  cacheName: { type: 'string', description: '具体 cache 名 (entries/delete 时)' },
  action: { type: 'string', description: 'list/entries/delete' },
};

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (list/entries/delete)' };

    if (args.action === 'list') {
      if (!args.origin) return { ok: false, error: 'origin required' };
      // CacheStorage domain 是 browser-level
      const r = await sendCommand('Storage.getUsageAndQuota', { origin: args.origin, storageTypes: 'cache_storage' });
      const caches = await sendCommand('CacheStorage.requestCacheNames', { origin: args.origin }).catch(() => null);
      return {
        ok: true,
        origin: args.origin,
        quota: r.quota,
        usage: r.usage,
        caches: caches?.caches || [],
      };
    }

    if (args.action === 'entries') {
      if (!args.origin || !args.cacheName) return { ok: false, error: 'origin + cacheName required' };
      const r = await sendCommand('CacheStorage.requestEntries', {
        origin: args.origin,
        cacheName: args.cacheName,
        skipCount: 0,
        pageSize: 100,
      });
      return {
        ok: true,
        cacheName: args.cacheName,
        entryCount: (r.cacheDataEntries || []).length,
        entries: (r.cacheDataEntries || []).map(e => ({
          request: e.request?.url,
          responseStatus: e.response?.status,
          responseType: e.response?.mimeType,
        })),
      };
    }

    if (args.action === 'delete') {
      if (!args.origin) return { ok: false, error: 'origin required' };
      if (args.cacheName) {
        await sendCommand('CacheStorage.deleteCache', { origin: args.origin, cacheName: args.cacheName });
        return { ok: true, deleted: args.cacheName };
      }
      await sendCommand('CacheStorage.deleteCache', { origin: args.origin, cacheName: '*' }).catch(() => {});
      // fallback: 删整个 storage
      await sendCommand('Storage.clearDataForOrigin', {
        origin: args.origin,
        storageTypes: 'cache_storage',
      });
      return { ok: true, cleared: 'all caches for ' + args.origin };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}