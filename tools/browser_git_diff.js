// tools/browser_git_diff.js — Git 文件差异
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const name = 'browser_git_diff';
export const description = '查看 Git 文件差异（未暂存）';
export const parameters = {
  cwd: { type: 'string', description: 'Git 仓库根目录路径（绝对路径）' },
  file: { type: 'string', description: '文件路径（相对于仓库根目录），不传则显示全部差异' },
};

export async function execute(args) {
  if (!args.cwd) return { ok: false, error: 'cwd required' };
  const cmd = args.file ? `git diff "${args.file}"` : 'git diff';
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: args.cwd });
    const diff = stdout || stderr || '(no changes)';
    return { ok: true, data: diff };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}