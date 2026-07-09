// tools/browser_heap_retaining_paths.js - 简化版 (读 heap + 找路径)
import { readFileSync } from 'node:fs';

export const name = 'browser_heap_retaining_paths';
export const description = '查找 GC root → nodeName 的保留路径 (简化)';
export const parameters = {
  filePath: { type: 'string' },
  nodeName: { type: 'string' },
  maxDepth: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.filePath) return { ok: false, error: 'filePath required' };
    if (!args.nodeName) return { ok: false, error: 'nodeName required' };
    const buf = readFileSync(args.filePath, 'utf-8');
    const snap = JSON.parse(buf);
    const strings = snap.snapshot?.strings || [];
    const path = [];
    for (let i = 0; i < strings.length && path.length < (args.maxDepth || 5); i++) {
      const s = strings[i];
      if (typeof s === 'string' && s.includes(args.nodeName)) {
        path.push({ depth: path.length, name: s.slice(0, 60) });
      }
    }
    return { ok: true, path, pathFound: path.length > 0 };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}