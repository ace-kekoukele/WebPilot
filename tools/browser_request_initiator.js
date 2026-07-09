// tools/browser_request_initiator.js - 简化
import * as network from './browser_network.js';

export const name = 'browser_request_initiator';
export const description = '查 network request 的发起者信息';
export const parameters = {
  targetId: { type: 'string' },
  requestId: { type: 'string' },
};

export async function execute(args) {
  return network.execute({ ...args, action: 'initiator' }, {});
}