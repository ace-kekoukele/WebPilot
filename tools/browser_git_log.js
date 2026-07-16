// tools/browser_git_log.js — Git 提交历史
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export const name = 'browser_git_log';
export const description = '查看 Git 提交历史';
export const parameters = {
  cwd: { type: 'string', description: 'Git 仓库根目录路径（绝对路径）' },
  limit: { type: 'number', description: '限制条数，默认 10' },
};

export async function execute(args) {
  if (!args.cwd) return { ok: false, error: 'cwd required' };
  const limit = args.limit || 10;
  try {
    const { stdout } = await execAsync(
      `git log --oneline -${limit} --format="%h %s (%an)"`,
      { cwd: args.cwd }
    );
    const lines = stdout.trim().split('\n').filter(Boolean);
    return { ok: true, data: lines };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}