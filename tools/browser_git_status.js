// tools/browser_git_status.js — Git 工作区状态
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const name = 'browser_git_status';
export const description = '查看 Git 工作区状态';
export const parameters = {
  cwd: { type: 'string', description: 'Git 仓库根目录路径（绝对路径）' },
};

export async function execute(args) {
  if (!args.cwd) return { ok: false, error: 'cwd required' };
  try {
    const { stdout, stderr } = await execAsync('git status --short', { cwd: args.cwd });
    const lines = (stdout || stderr).trim().split('\n').filter(Boolean);
    return { ok: true, data: lines.length ? lines : ['(clean)'] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}