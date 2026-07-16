// tools/browser_fs_read.js — 读取文件内容
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const name = 'browser_fs_read';
export const description = '读取文件内容';
export const parameters = {
  path: { type: 'string', description: '文件路径（绝对路径）' },
  encoding: { type: 'string', description: '编码，默认 utf-8' },
};

export async function execute(args) {
  if (!args.path) return { ok: false, error: 'path required' };
  try {
    const content = await readFile(resolve(args.path), args.encoding || 'utf-8');
    return { ok: true, data: content };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}