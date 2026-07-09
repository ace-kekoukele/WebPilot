// tools/browser_fetch.js — Fetch/XHR 拦截 + 模拟响应 + 列表 (v4.0.4 修复版)
import { sendPageCommand } from '../lib/cdp/index.js';
import { on } from '../lib/cdp/index.js';

export const name = 'browser_fetch';
export const description = 'Fetch/XHR 拦截 + 模拟响应 + 列表 (v4.0.4 修复版)';
export const parameters = {
  targetId: { type: 'string', description: '标签页 targetId' },
  urlPattern: { type: 'string', description: 'URL 模式 (glob, 如 *api.example.com/*)' },
  action: { type: 'string', description: 'enable/disable/list/intercept' },
  responseStatus: { type: 'number', description: 'intercept 时返回的状态码（默认 200）' },
  responseBody: { type: 'string', description: 'intercept 时返回的 body' },
  responseHeaders: { type: 'array', description: 'intercept 时返回的 headers [{name,value}]' },
  collectMs: { type: 'number', description: 'list/intercept 收集时长毫秒（默认 3000）' },
};

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    if (!args.action) return { ok: false, error: 'action required' };

    if (args.action === 'enable') {
      if (!args.urlPattern) return { ok: false, error: 'urlPattern required' };
      await sendPageCommand(args.targetId, 'Fetch.enable', {
        patterns: [{ urlPattern: args.urlPattern, requestStage: 'Request' }],
      }, 3000);
      return { ok: true, enabled: true, pattern: args.urlPattern };
    }

    if (args.action === 'disable') {
      await sendPageCommand(args.targetId, 'Fetch.disable', {}, 3000);
      return { ok: true, disabled: true };
    }

    if (args.action === 'list') {
      const requests = [];
      // on() 返回 unsubscribe 函数
      const unsubscribe = on('Fetch.requestPaused', (params) => {
        requests.push({
          requestId: params.requestId,
          url: params.request?.url,
          method: params.request?.method,
          headers: params.request?.headers,
          postData: params.request?.postData,
        });
      });
      try {
        await sendPageCommand(args.targetId, 'Fetch.enable', {
          patterns: args.urlPattern
            ? [{ urlPattern: args.urlPattern, requestStage: 'Response' }]
            : [],
        }, 3000);
        await new Promise((r) => setTimeout(r, args.collectMs || 3000));
      } finally {
        unsubscribe(); // 调用 on() 返回的 unsubscribe
        await sendPageCommand(args.targetId, 'Fetch.disable', {}, 3000).catch(() => {});
      }
      return { ok: true, requestCount: requests.length, requests };
    }

    if (args.action === 'intercept') {
      if (!args.urlPattern) return { ok: false, error: 'urlPattern required' };
      await sendPageCommand(args.targetId, 'Fetch.enable', {
        patterns: [{ urlPattern: args.urlPattern, requestStage: 'Request' }],
      }, 3000);

      const unsubscribe = on('Fetch.requestPaused', async (params) => {
        try {
          await sendPageCommand(args.targetId, 'Fetch.fulfillRequest', {
            requestId: params.requestId,
            responseCode: args.responseStatus || 200,
            responseHeaders: args.responseHeaders || [],
            body: args.responseBody ? Buffer.from(args.responseBody).toString('base64') : '',
          }, 5000);
        } catch {
          // 兜底: 继续原始请求
          try {
            await sendPageCommand(args.targetId, 'Fetch.continueRequest', { requestId: params.requestId }, 3000);
          } catch {}
        }
      });

      try {
        await new Promise((r) => setTimeout(r, args.collectMs || 3000));
      } finally {
        unsubscribe();
        await sendPageCommand(args.targetId, 'Fetch.disable', {}, 3000).catch(() => {});
      }
      return {
        ok: true,
        intercepted: true,
        durationMs: args.collectMs || 3000,
        pattern: args.urlPattern,
      };
    }

    return { ok: false, error: `unknown action: ${args.action}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
