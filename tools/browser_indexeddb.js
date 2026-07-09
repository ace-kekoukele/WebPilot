// tools/browser_indexeddb.js - IndexedDB 高级操作 (Chrome 150 IndexedDB 域)
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_indexeddb';
export const description = 'IndexedDB 高级操作: list databases/stores/get all (Chrome 150 IndexedDB 域)';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'listDatabases/listObjectStores/getAll/clear' },
  dbName: { type: 'string', description: 'database name' },
  storeName: { type: 'string', description: 'object store name (getAll/clear)' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required (listDatabases/listObjectStores/getAll/clear)' };

    await sendPageCommand(args.targetId, 'IndexedDB.enable', {}, 3000).catch(() => {});

    if (args.action === 'listDatabases') {
      const r = await sendPageCommand(args.targetId, 'IndexedDB.requestDatabaseNames', {}, 5000);
      return { ok: true, databases: r.databaseNames || [], count: (r.databaseNames || []).length };
    }

    if (args.action === 'listObjectStores') {
      if (!args.dbName) return { ok: false, error: 'dbName required' };
      const r = await sendPageCommand(args.targetId, 'IndexedDB.requestDatabase', {
        name: args.dbName,
      }, 5000);
      return {
        ok: true,
        dbName: r.databaseWithObjectStores?.name,
        version: r.databaseWithObjectStores?.version,
        stores: (r.databaseWithObjectStores?.objectStores || []).map(s => ({
          name: s.name,
          keyPath: s.keyPath,
          autoIncrement: s.autoIncrement,
        })),
      };
    }

    if (args.action === 'getAll') {
      if (!args.dbName || !args.storeName) return { ok: false, error: 'dbName + storeName required' };
      const r = await sendPageCommand(args.targetId, 'IndexedDB.getAll', {
        databaseName: args.dbName,
        objectStoreName: args.storeName,
      }, 10000);
      return {
        ok: true,
        dbName: args.dbName,
        storeName: args.storeName,
        entryCount: (r.objectStoreDataEntries || []).length,
        entries: r.objectStoreDataEntries || [],
      };
    }

    if (args.action === 'clear') {
      if (!args.dbName) return { ok: false, error: 'dbName required' };
      await sendPageCommand(args.targetId, 'IndexedDB.clearObjectStore', {
        databaseName: args.dbName,
        objectStoreName: args.storeName,
      }, 5000);
      return { ok: true, cleared: args.dbName + (args.storeName ? '/' + args.storeName : '') };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}