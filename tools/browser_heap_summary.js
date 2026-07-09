// tools/browser_heap_summary.js - heap snapshot 摘要
import { readFileSync } from 'node:fs';

export const name = 'browser_heap_summary';
export const description = '读取 .heapsnapshot 返回摘要';
export const parameters = { filePath: { type: 'string' } };

export async function execute(args) {
  try {
    if (!args.filePath) return { ok: false, error: 'filePath required' };
    const buf = readFileSync(args.filePath, 'utf-8');
    const snap = JSON.parse(buf);
    const strings = snap.snapshot?.strings || [];
    const stringCount = strings.filter((s) => typeof s === 'string').length;
    const totalStrSize = strings.reduce((s, x) => s + (typeof x === 'string' ? x.length : 0), 0);
    return {
      ok: true,
      stringCount,
      totalStrSize,
      snapshotSize: buf.length,
      metaData: snap.snapshot?.metaData || {},
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}