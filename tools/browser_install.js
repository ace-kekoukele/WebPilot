// tools/browser_install.js - 安装健康检查
import { ensureBridge } from '../lib/cdp/index.js';

export const name = 'browser_install';
export const description = '插件安装状态';
export const parameters = {};

export async function execute(args) {
  try {
    await ensureBridge();
    return { ok: true, installed: true, version: '1.7.0' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}