// tools/browser_dump_structure.js — 提取页面结构 (§3.5.1 网站逆向: 前端)
// 主要分析:
//   - 页面标题 / URL / viewport
//   - DOM 树 (层级 + tag + ID + class + role)
//   - 表单 (input 列表 + 校验规则)
//   - 链接 (相对 + 绝对)
//   - meta 标签 + og:tags + JSON-LD
//   - 第三方依赖检测 (从 script src 反推)
//   - 入口点 (按钮 / onclick / form action)
//   - localStorage / cookie / sessionStorage 键 (只列名, 不读值)

import { evaluate, sendCommand } from '../lib/cdp/index.js';

export const name = 'browser_dump_structure';
export const description = '提取页面结构 + 表单 + 链接 + meta + 入口点 (§3.5.1 前端逆向)';
export const parameters = {
  targetId: { type: 'string', required: true },
  maxDepth: { type: 'number' },
  includeStorage: { type: 'boolean' },
};

const STRUCTURE_JS = `(args) => {
  const maxDepth = args.maxDepth ?? 6;
  const includeStorage = args.includeStorage ?? true;

  function describe(el, depth) {
    if (!el || depth > maxDepth) return null;
    if (el.nodeType !== 1) return null;   // 只 Element
    const skip = new Set(['SCRIPT','STYLE','META','LINK','BR','HR','SVG','PATH']);
    if (skip.has(el.tagName)) return null;
    const attrs = {};
    for (const a of el.attributes || []) {
      if (/^(class|id|name|href|src|type|role|placeholder|value|aria-label|data-test)$/i.test(a.name)) {
        attrs[a.name] = a.value.slice(0, 100);
      }
    }
    return {
      tag: el.tagName.toLowerCase(),
      attrs,
      children: Array.from(el.children)
        .map((c) => describe(c, depth + 1))
        .filter(Boolean),
    };
  }

  // 链接
  const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map((a) => ({
    text: a.textContent.trim().slice(0, 50),
    href: a.href,                              // 绝对
    relative: a.getAttribute('href'),
    target: a.target || '_self',
  })).filter((l) => l.href);

  // 表单
  const forms = Array.from(document.forms || []).map((f) => ({
    action: f.action,
    method: f.method,
    enctype: f.enctype,
    inputs: Array.from(f.elements).map((el) => ({
      name: el.name,
      type: el.type,
      required: el.required,
      pattern: el.pattern,
      placeholder: el.placeholder,
      maxLength: el.maxLength > 0 ? el.maxLength : undefined,
    })).filter((x) => x.name),
  }));

  // meta + 第三方依赖
  const meta = {};
  for (const m of document.querySelectorAll('meta')) {
    const k = m.name || m.getAttribute('property') || m.getAttribute('http-equiv');
    if (k) meta[k] = m.content?.slice(0, 200) || null;
  }
  for (const m of document.querySelectorAll('link[rel*=icon]')) {
    meta['icon'] = m.href;
  }
  const deps = new Set();
  for (const s of document.querySelectorAll('script[src]')) deps.add(s.src);
  for (const l of document.querySelectorAll('link[href][rel=stylesheet]')) deps.add(l.href);
  for (const img of document.querySelectorAll('img[src]')) {
    if (/^https?:/.test(img.src)) deps.add(img.src);
  }

  // 入口点
  const entryPoints = [];
  for (const b of document.querySelectorAll('button, [role=button]')) {
    entryPoints.push({
      tag: b.tagName.toLowerCase(),
      text: b.textContent.trim().slice(0, 40) || b.getAttribute('aria-label') || '',
      type: b.type || undefined,
      onclick: !!b.onclick || !!b.getAttribute('onclick'),
    });
  }

  const result = {
    title: document.title,
    url: location.href,
    origin: location.origin,
    viewport: { w: innerWidth, h: innerHeight },
    dom: describe(document.documentElement, 0),
    linksCount: links.length,
    links: links.slice(0, 50),
    forms,
    meta,
    dependencies: [...deps].slice(0, 100),
    entryPointsCount: entryPoints.length,
    entryPoints: entryPoints.slice(0, 50),
  };

  if (includeStorage) {
    result.localStorageKeys = Object.keys(localStorage);
    result.sessionStorageKeys = Object.keys(sessionStorage);
    result.cookieNames = document.cookie
      ? document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter(Boolean)
      : [];
  }

  return result;
}`;

export async function execute(args) {
  try {
    if (!args.targetId) return { ok: false, error: 'targetId required' };
    const r = await evaluate(args.targetId, STRUCTURE_JS, {
      args: { maxDepth: args.maxDepth || 6, includeStorage: args.includeStorage !== false },
      returnByValue: true,
      awaitPromise: false,
    });
    if (r.exceptionDetails) return { ok: false, error: r.exceptionDetails.exception?.description || 'JS error' };
    return { ok: true, structure: r.result?.value };
  } catch (err) { return { ok: false, error: err.message }; }
}
