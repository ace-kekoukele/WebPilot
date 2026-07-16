// tools/browser_network_get.js - 简化
import * as network from './browser_network.js';

export const name = 'browser_network_get';
export const description = '查 network request 详情';
export const parameters = {
  targetId: { type: 'string' },
  requestId: { type: 'string' },
};

export async function execute(args) {
  return network.execute({ ...args, action: 'get' }, {});
}