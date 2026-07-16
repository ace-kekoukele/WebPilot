// tools/browser_fs_write.js — 写入文件内容
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const name = 'browser_fs_write';
export const description = '写入内容到文件（覆盖）';
export const parameters = {
  path: { type: 'string', description: '文件路径（绝对路径）' },
  content: { type: 'string', description: '文件内容' },
  encoding: { type: 'string', description: '编码，默认 utf-8' },
};

export async function execute(args) {
  if (!args.path) return { ok: false, error: 'path required' };
  if (!args.content && args.content !== 0) return { ok: false, error: 'content required' };
  try {
    await writeFile(resolve(args.path), args.content, args.encoding || 'utf-8');
    return { ok: true, data: 'written' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}