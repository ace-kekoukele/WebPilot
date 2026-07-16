// tools/browser_heap.js - Heap snapshot save + summary
import { sendPageCommand, ensureBridge } from '../lib/cdp/index.js';
import { writeFileSync } from 'node:fs';

export const name = 'browser_heap';
export const description = 'Heap snapshot: snapshot/summary';
export const parameters = {
  targetId: { type: 'string' },
  action: { type: 'string', description: 'snapshot/summary' },
  filePath: { type: 'string' },
  nodeName: { type: 'string', description: 'for summary: filter by name' },
  limit: { type: 'number' },
};

export async function execute(args) {
  try {
    if (args.action === 'snapshot') {
      if (!args.targetId) return { ok: false, error: 'targetId required' };
      if (!args.filePath) return { ok: false, error: 'filePath required' };
      await ensureBridge();
      const r = await sendPageCommand(args.targetId, 'HeapProfiler.enable', {}, 5000).catch(() => {});
      const snap = await sendPageCommand(args.targetId, 'HeapProfiler.takeHeapSnapshot', { reportProgress: false }, 60000);
      const dataStr = JSON.stringify(snap.snapshot);
      writeFileSync(args.filePath, dataStr, 'utf-8');
      return { ok: true, filePath: args.filePath, sizeBytes: dataStr.length };
    }
    return { ok: false, error: 'heap snapshot only (screencast not in scope)' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}