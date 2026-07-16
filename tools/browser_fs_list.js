// tools/browser_fs_list.js — 列出目录内容
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const name = 'browser_fs_list';
export const description = '列出目录中的文件与文件夹';
export const parameters = {
  path: { type: 'string', description: '目录路径（绝对路径）' },
  recursive: { type: 'boolean', description: '递归列出子目录，默认 false' },
};

export async function execute(args) {
  if (!args.path) return { ok: false, error: 'path required' };
  try {
    const entries = await readdir(resolve(args.path), { withFileTypes: true, recursive: args.recursive || false });
    const result = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: e.parentPath ? resolve(e.parentPath, e.name) : resolve(args.path, e.name),
    }));
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}