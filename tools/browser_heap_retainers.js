// tools/browser_heap_retainers.js - 简化版 (读 heap snapshot + 找 retainers)
import { readFileSync, statSync } from 'node:fs';

export const name = 'browser_heap_retainers';
export const description = '查找指定节点的 retainers (简化: 基于 .heapsnapshot JSON)';
export const parameters = {
  filePath: { type: 'string' },
  nodeName: { type: 'string' },
  limit: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.filePath) return { ok: false, error: 'filePath required' };
    if (!args.nodeName) return { ok: false, error: 'nodeName required' };
    const buf = readFileSync(args.filePath, 'utf-8');
    const snap = JSON.parse(buf);
    const meta = snap.snapshot?.metaData || {};
    const nodes = snap.snapshot?.nodeFields || [];
    const strings = snap.snapshot?.strings || [];
    const nodeTypes = snap.snapshot?.nodeTypes || [];
    // 简化搜索: 找含 nodeName 的 string index
    const matches = [];
    for (let i = 0; i < strings.length && matches.length < (args.limit || 50); i++) {
      const s = strings[i];
      if (typeof s === 'string' && s.includes(args.nodeName)) {
        matches.push({ stringIndex: i, value: s.slice(0, 100) });
      }
    }
    return { ok: true, matchCount: matches.length, matches };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}