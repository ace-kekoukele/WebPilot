// tools/browser_dump_js.js — 提取页面 JS 资产 (§3.5.1 前端逆向)
// 找出:
//   - 全局 window 上的所有自定义属性 (window.*)
//   - 全部 inline script 源码
//   - 外部 script 列表 (URL only, 不下载)
//   - 暴露的函数 / 类 (从 window 抓)
//   - 拦截/hook 的点 (onclick / onerror 等)

import { evaluate } from '../lib/cdp/index.js';

export const name = 'browser_dump_js';
export const description = '提取 window.* 全局 / inline scripts / 函数 (§3.5.1 前端逆向)';
export const parameters = {
  targetId: { type: 'string', required: true },
  includeInlineSource: { type: 'boolean' },
  includeWindowKeys: { type: 'boolean' },
};

const DUMP_JS = `(args) => {
  const out = {};

  // 1. window 全局属性 (过滤常见框架前缀 + 内置 - 列出自定义的)
  if (args.includeWindowKeys !== false) {
    const own = [];
    const builtin = /^(window|document|navigator|location|history|console|fetch|XMLHttpRequest|localStorage|sessionStorage|crypto|atob|btoa|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|cancelAnimationFrame|getComputedStyle|Math|Date|Object|Array|JSON|Promise|Map|Set|Symbol|BigInt|Error|Number|String|Boolean|RegExp|Function|Math|Reflect|Proxy|Intl|WeakMap|WeakSet|FinalizationRegistry|GCrypto|atob|btoa|setImmediate|clearImmediate|process|Buffer|global|globalThis|module|require|exports|__dirname|__filename|setTimeout|setInterval|clearTimeout|clearInterval)$/;
    for (const k of Object.getOwnPropertyNames(window)) {
      if (builtin.test(k)) continue;
      if (k.startsWith('webkit') || k.startsWith('chrome') || k.startsWith('on')) continue;
      try {
        const v = window[k];
        const t = typeof v;
        let sig = '';
        if (t === 'function') sig = v.toString().slice(0, 200);
        else if (v !== null && v !== undefined) sig = String(v).slice(0, 80);
        own.push({ key: k, type: t, value: sig });
      } catch {}
    }
    out.windowGlobals = own.slice(0, 100);   // 上限防炸
  }

  // 2. inline scripts (不带 [src] 的)
  if (args.includeInlineSource !== false) {
    const inlines = [];
    for (const s of document.querySelectorAll('script:not([src])')) {
      const code = s.textContent;
      if (code && code.length > 0) {
        inlines.push({
          length: code.length,
          source: code.slice(0, 5000),  // 限 5KB / script, 多截几段
          varDefs: [...code.matchAll(/(?:function|const|let|var|class)\\s+([A-Za-z_$][\\w$]*)\\s*[=(]/g)].map((m) => m[1]).slice(0, 20),
        });
      }
    }
    out.inlineScripts = inlines.slice(0, 10);   // 上限
    out.inlineScriptCount = inlines.length;
  }

  // 3. 外部 script 列表 (仅 URL)
  out.externalScripts = Array.from(document.querySelectorAll('script[src]'))
    .map((s) => s.src).filter(Boolean);

  // 4. 事件处理器 (onclick 等)
  out.eventHandlers = [];
  for (const el of document.querySelectorAll('*')) {
    for (const attr of el.attributes || []) {
      if (/^on/.test(attr.name)) {
        out.eventHandlers.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || undefined,
          class: el.className?.slice(0, 50) || undefined,
          handler: attr.name,
          body: attr.value.slice(0, 200),
        });
      }
    }
  }
  out.eventHandlerCount = out.eventHandlers.length;
  out.eventHandlers = out.eventHandlers.slice(0, 50);

  return out;
}`;

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    const r = await evaluate(args.targetId, DUMP_JS, {
      args: { includeInlineSource: args.includeInlineSource !== false, includeWindowKeys: args.includeWindowKeys !== false },
      returnByValue: true,
      awaitPromise: false,
    });
    if (r.exceptionDetails) return { ok: false, error: r.exceptionDetails.exception?.description || 'JS error' };
    return { ok: true, dump: r.result?.value };
  } catch (err) { return { ok: false, error: err.message }; }
}
