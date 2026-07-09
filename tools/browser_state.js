// tools/browser_state.js - 桥状态
import { getState } from '../lib/cdp/index.js';

export const name = 'browser_state';
export const description = 'Bridge 内部状态 (connected/tabs/pending)';
export const parameters = {};

export async function execute(args) {
  return { ok: true, state: getState() };
}