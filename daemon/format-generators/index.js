// daemon/format-generators/index.js — 路由器
// daemon/format-generators/openai.js + anthropic.js + openapi.js
//
// 用法:
//   const tools = await loadAllToolsSpec();      // 内部 cache
//   const openaiFmt = formatGenerators.openai(tools);
//   const anthropicFmt = formatGenerators.anthropic(tools);
//   const openapiSpec = formatGenerators.openapi(tools);
//
// lib/http-api.js 调 openapi() 来生成 /api/openapi.json

import * as openai from './openai.js';
import * as anthropic from './anthropic.js';
import * as openapi from './openapi.js';
import * as gemini from './gemini.js';

export { openai, anthropic, openapi, gemini };

// tools spec loader — 跟 lib/tool-loader.js 共用 schema 但加 description 清洗
// (tools.description 限 200 字符, 这里清洗掉特殊字符)
let _cache = null;
export async function loadAllToolsSpec() {
  if (_cache && (Date.now() - _cache.loadedAt) < 30_000) return _cache.tools;
  const { loadAllTools: lowLevel } = await import('../../lib/tool-loader.js');
  const low = await lowLevel();
  const tools = low.filter((t) => t && t.name && t.parameters).map((t) => ({
    name: t.name,
    description: String(t.description || t.name).slice(0, 200),
    parameters: t.parameters || {},
  }));
  _cache = { tools, loadedAt: Date.now() };
  return tools;
}

export function invalidateFormatCache() {
  _cache = null;
}
