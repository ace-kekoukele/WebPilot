// tools/browser_emulation.js - 设备模拟
import { sendPageCommand } from '../lib/cdp/index.js';

export const name = 'browser_emulation';
export const description = '设备/网络/UA 模拟';
export const parameters = {
  targetId: { type: 'string' },
  deviceWidth: { type: 'number' },
  deviceHeight: { type: 'number' },
  deviceScaleFactor: { type: 'number' },
  mobile: { type: 'boolean' },
  userAgent: { type: 'string' },
  locale: { type: 'string' },
  timezone: { type: 'string' },
  offline: { type: 'boolean' },
  downloadThroughputBps: { type: 'number' },
  uploadThroughputBps: { type: 'number' },
  latencyMs: { type: 'number' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (args.deviceWidth || args.deviceHeight || args.deviceScaleFactor !== undefined || args.mobile !== undefined) {
      await sendPageCommand(args.targetId, 'Emulation.setDeviceMetricsOverride', {
        width: args.deviceWidth || 1280,
        height: args.deviceHeight || 720,
        deviceScaleFactor: args.deviceScaleFactor || 1,
        mobile: !!args.mobile,
      }, 5000);
    }
    if (args.userAgent || args.locale) {
      await sendPageCommand(args.targetId, 'Emulation.setUserAgentOverride', {
        userAgent: args.userAgent || '',
        acceptLanguage: args.locale || 'en-US',
      }, 5000);
    }
    if (args.timezone) {
      await sendPageCommand(args.targetId, 'Emulation.setTimezoneOverride', { timezoneId: args.timezone }, 5000);
    }
    if (args.offline !== undefined || args.downloadThroughputBps || args.uploadThroughputBps || args.latencyMs) {
      await sendPageCommand(args.targetId, 'Network.enable', {}, 3000).catch(() => {});
      await sendPageCommand(args.targetId, 'Network.emulateNetworkConditions', {
        offline: !!args.offline,
        downloadThroughput: args.downloadThroughputBps || -1,
        uploadThroughput: args.uploadThroughputBps || -1,
        latency: args.latencyMs || 0,
      }, 5000);
    }
    return { ok: true, targetId: args.targetId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}