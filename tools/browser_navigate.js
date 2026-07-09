// tools/browser_navigate.js — 导航到 URL（支持智能重试和等待条件）
import { sendPageCommand, evaluate, ensureBridge, navigate } from '../lib/cdp/index.js';

export const name = 'browser_navigate';
export const description = '导航到 URL（支持重试和等待条件）';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  url: { type: 'string', description: '目标 URL' },
  timeout: { type: 'number', description: '超时毫秒（默认 60000）' },
  waitForSelector: { type: 'string', description: '等待特定选择器出现' },
  waitForNetworkIdle: { type: 'boolean', description: '等待网络空闲（默认 false）' },
  retry: { type: 'number', description: '失败重试次数（默认 2）' },
};

export async function execute(args) {
  if (!args.targetId) return { ok: false, error: 'targetId required' };
  if (!args.url) return { ok: false, error: 'url required' };

  const timeout = args.timeout || 60000;
  const maxRetries = args.retry ?? 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await ensureBridge();

      const r = await sendPageCommand(args.targetId, 'Page.navigate', { url: args.url }, timeout);
      if (r.errorText) {
        if (attempt < maxRetries) continue;
        return { ok: false, error: r.errorText };
      }

      // 等待网络空闲
      if (args.waitForNetworkIdle) {
        await waitForNetworkIdle(args.targetId, 30000);
      }

      // 等待选择器
      if (args.waitForSelector) {
        await waitForSelector(args.targetId, args.waitForSelector, 30000);
      }

      return { ok: true, frameId: r.frameId, loaderId: r.loaderId, url: args.url, attempt: attempt + 1 };
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { ok: false, error: err.message };
    }
  }
}

async function waitForNetworkIdle(targetId, timeout) {
  const start = Date.now();
  let lastCount = 0;
  while (Date.now() - start < timeout) {
    const state = await evaluate(targetId, `(function() {
      const entries = performance.getEntriesByType('resource');
      return {
        requests: entries.length,
        pending: performance.resourceTimingBufferSize - entries.length
      };
    })()`, { returnByValue: true, awaitPromise: false });
    const count = state?.result?.value?.requests || 0;
    if (count === lastCount && count > 0) return; // 空闲
    lastCount = count;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function waitForSelector(targetId, selector, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await evaluate(targetId,
      `(function(sel) { return !!document.querySelector(sel); })(arguments[0])`,
      { args: [selector], returnByValue: true, awaitPromise: false }
    );
    if (state?.result?.value === true) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}
