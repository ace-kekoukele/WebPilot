// tools/browser_storage.js - Storage 管理 (Chrome 150 新增域)
// 支持: localStorage / sessionStorage / IndexedDB / CacheStorage + quota 查询
import { sendCommand, sendPageCommand, ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_storage';
export const description = 'Storage 管理: local/session/IndexedDB/CacheStorage + quota (Chrome 150+)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  action: { type: 'string', description: 'list/get/set/remove/clear/quota' },
  type: { type: 'string', description: 'local/session/indexeddb/cache (按 storage 类型)' },
  origin: { type: 'string', description: 'origin (e.g. https://example.com)' },
  key: { type: 'string', description: '存储 key' },
  value: { type: 'string', description: '存储 value (set 时)' },
};

export async function execute(args) {
  try {
    if (!args.action) return { ok: false, error: 'action required (list/get/set/remove/clear/quota)' };

    // quota 和 clearByOrigin 不需要 targetId (browser-level)
    if (args.action === 'quota') {
      await ensureBridge();
      const r = await sendCommand('Storage.getQuotaForOrigin', {
        origin: args.origin || 'https://www.example.com',
      });
      return {
        ok: true,
        origin: r.origin,
        quota: r.quota,
        usage: r.usage,
        usageBreakdown: r.usageBreakdown || [],
      };
    }

    if (!args.targetId) return { ok: false, error: 'targetId required' };

    if (args.action === 'list') {
      if (args.type === 'indexeddb') {
        // 列出 IndexedDB 数据库和 object stores
        const dbList = await sendPageCommand(args.targetId, 'IndexedDB.requestDatabaseNames', {
          securityOrigin: args.origin || '*',
        }, 5000);
        const dbNames = dbList.databaseNames || [];
        const databases = [];
        for (const dbName of dbNames) {
          try {
            const metadata = await sendPageCommand(args.targetId, 'IndexedDB.requestDatabase', {
              securityOrigin: args.origin || '*',
              databaseName: dbName,
            }, 5000);
            databases.push({
              name: dbName,
              version: metadata.databaseWithObjectStores?.version,
              objectStores: (metadata.databaseWithObjectStores?.objectStores || []).map(s => ({
                name: s.name,
                keyPath: s.keyPath,
                autoIncrement: s.autoIncrement,
                indexes: (s.indexes || []).map(i => ({ name: i.name, keyPath: i.keyPath, unique: i.unique })),
              })),
            });
          } catch {
            databases.push({ name: dbName, error: '无法读取元数据' });
          }
        }
        return {
          ok: true,
          storageType: 'indexeddb',
          origin: args.origin || '*',
          count: dbNames.length,
          databases,
        };
      }

      // 列 localStorage + sessionStorage
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `(() => {
          const out = { localStorage: {}, sessionStorage: {} };
          try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.localStorage[k] = localStorage.getItem(k); } } catch (e) { out.localStorageError = e.message; }
          try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); out.sessionStorage[k] = sessionStorage.getItem(k); } } catch (e) { out.sessionStorageError = e.message; }
          return JSON.stringify(out);
        })()`,
        returnByValue: true,
      }, 5000);
      const data = JSON.parse(r.result.value);
      return {
        ok: true,
        localStorageCount: Object.keys(data.localStorage).length,
        sessionStorageCount: Object.keys(data.sessionStorage).length,
        localStorage: data.localStorage,
        sessionStorage: data.sessionStorage,
        errors: { local: data.localStorageError, session: data.sessionStorageError },
      };
    }

    if (args.action === 'get') {
      if (!args.key) return { ok: false, error: 'key required' };
      if (args.type === 'indexeddb') {
        return await _indexedDbGet(args);
      }
      if (!args.type) return { ok: false, error: 'type required (local/session/indexeddb)' };
      const storageType = args.type === 'session' ? 'sessionStorage' : 'localStorage';
      const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `${storageType}.getItem(${JSON.stringify(args.key)})`,
        returnByValue: true,
      }, 5000);
      return { ok: true, key: args.key, value: r.result.value };
    }

    if (args.action === 'set') {
      if (!args.key) return { ok: false, error: 'key required' };
      if (args.type === 'indexeddb') {
        return await _indexedDbPut(args);
      }
      const storageType = args.type === 'session' ? 'sessionStorage' : 'localStorage';
      await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `${storageType}.setItem(${JSON.stringify(args.key)}, ${JSON.stringify(args.value || '')})`,
        returnByValue: true,
      }, 5000);
      return { ok: true, key: args.key, value: args.value || '' };
    }

    if (args.action === 'remove') {
      if (!args.key) return { ok: false, error: 'key required' };
      const storageType = args.type === 'session' ? 'sessionStorage' : 'localStorage';
      await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `${storageType}.removeItem(${JSON.stringify(args.key)})`,
        returnByValue: true,
      }, 5000);
      return { ok: true, removed: args.key };
    }

    if (args.action === 'clear') {
      if (args.type === 'indexeddb') {
        // IndexedDB 通过 CDP 域
        if (!args.origin) return { ok: false, error: 'origin required for indexeddb clear' };
        await sendCommand('Storage.clearDataForOrigin', {
          origin: args.origin,
          storageTypes: 'indexeddb',
        });
        return { ok: true, cleared: 'indexeddb', origin: args.origin };
      }
      if (args.type === 'cache') {
        if (!args.origin) return { ok: false, error: 'origin required for cache clear' };
        await sendCommand('Storage.clearDataForOrigin', {
          origin: args.origin,
          storageTypes: 'cache_storage',
        });
        return { ok: true, cleared: 'cache_storage', origin: args.origin };
      }
      // local / session
      const storageType = args.type === 'session' ? 'sessionStorage' : 'localStorage';
      await sendPageCommand(args.targetId, 'Runtime.evaluate', {
        expression: `${storageType}.clear()`,
        returnByValue: true,
      }, 5000);
      return { ok: true, cleared: storageType };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// IndexedDB 读取 helper
async function _indexedDbGet(args) {
  const exp = `(async () => {
    return await new Promise((resolve) => {
      const req = indexedDB.open(${JSON.stringify(args.dbName || 'kv-db')}, ${args.dbVersion || 1});
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(${JSON.stringify(args.storeName || 'kv')}, 'readonly');
          const store = tx.objectStore(${JSON.stringify(args.storeName || 'kv')});
          const getReq = store.get(${JSON.stringify(args.key)});
          getReq.onsuccess = () => resolve({ ok: true, key: ${JSON.stringify(args.key)}, value: getReq.result });
          getReq.onerror = (e) => resolve({ ok: false, error: e.target.error?.message });
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
        db.close();
      };
      req.onerror = (e) => resolve({ ok: false, error: e.target.error?.message });
    });
  })()`;
  const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
    expression: exp,
    returnByValue: true,
    awaitPromise: true,
  }, 10000);
  return r.result.value || { ok: false, error: 'unknown' };
}

// IndexedDB 写入 helper (简单 key/value, 假设 store = 'kv')
async function _indexedDbPut(args) {
  const exp = `(async () => {
    return await new Promise((resolve) => {
      const req = indexedDB.open(${JSON.stringify(args.dbName || 'kv-db')}, ${args.dbVersion || 1});
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(${JSON.stringify(args.storeName || 'kv')})) {
          db.createObjectStore(${JSON.stringify(args.storeName || 'kv')});
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(${JSON.stringify(args.storeName || 'kv')}, 'readwrite');
        const store = tx.objectStore(${JSON.stringify(args.storeName || 'kv')});
        store.put(${JSON.stringify(args.value || '')}, ${JSON.stringify(args.key)});
        tx.oncomplete = () => resolve({ ok: true });
        tx.onerror = (e) => resolve({ ok: false, error: e.target.error?.message });
      };
      req.onerror = (e) => resolve({ ok: false, error: e.target.error?.message });
    });
  })()`;
  const r = await sendPageCommand(args.targetId, 'Runtime.evaluate', {
    expression: exp,
    returnByValue: true,
    awaitPromise: true,
  }, 10000);
  return r.result.value || { ok: false, error: 'unknown' };
}